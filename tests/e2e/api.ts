// The engine, as far as the browser can tell.
//
// Every request the console makes is answered here from tests/e2e/fixtures/,
// so a run needs no engine, no server.mjs and no network: `vite preview` serves
// the built bundle and Playwright answers everything under /api and /console.
//
// The table below is the whole contract. It was built by reading the api/
// directories rather than by watching a run, because a route that is only
// reached on a screen nobody opened is still a route the next test will need:
//
//   src/tools/lorebooks/data.ts          /lorebooks, /lorebooks/:id/entries
//   src/tools/presets/data.ts            /prompts, /prompts/:id/full
//   src/tools/memory/api/characters.ts   /characters
//   src/tools/memory/api/chats.ts        /chats
//   src/tools/memory/api/status.ts       /long-term-memory/status
//   src/tools/memory/api/notes.ts        /long-term-memory/notes, /notes/:id
//   src/tools/memory/api/drafts.ts       /long-term-memory/drafts/review
//   src/tools/memory/api/import.ts       /long-term-memory/import/preview
//   src/shell/state.ts                   /console/state/:key
//
// There is NO /long-term-memory/sources route, however much the Sources screen
// looks like there should be: store/sources.ts assembles that screen from the
// three import previews, the notes list and the review response.
//
// An unmatched request is answered 501 and RECORDED rather than left to fail.
// A request that simply hangs or errors reaches the app as an error state, and
// the test that follows blames the screen for a gap in this table; the recorded
// list is asserted empty in tests/e2e/harness.ts, which names the route instead.

import type { Page, Request } from "@playwright/test";
import { BOOKS, ENTRIES } from "./fixtures/lorebooks";
import { FULL, PRESETS } from "./fixtures/presets";
import { CHARACTERS, CHATS, NOTES, PREVIEWS, REVIEW, STATUS } from "./fixtures/memory";

export interface Route {
  method: "GET" | "POST" | "PUT";
  /** The pathname as the browser asks for it, `/api` prefix included. */
  path: RegExp;
  /** The payload, given the pattern's captures and the request that asked. */
  body: (match: RegExpMatchArray, request: Request) => unknown;
  /** Defaults to 200. */
  status?: number;
}

const json = (value: unknown): Route["body"] => () => value;

export const ROUTES: Route[] = [
  { method: "GET", path: /^\/api\/lorebooks$/, body: json(BOOKS) },
  { method: "GET", path: /^\/api\/lorebooks\/([^/]+)\/entries$/, body: (m) => ENTRIES[m[1]] ?? [] },

  { method: "GET", path: /^\/api\/prompts$/, body: json(PRESETS) },
  { method: "GET", path: /^\/api\/prompts\/([^/]+)\/full$/, body: (m) => FULL[m[1]] },

  { method: "GET", path: /^\/api\/characters$/, body: json(CHARACTERS) },
  { method: "GET", path: /^\/api\/chats$/, body: json(CHATS) },

  { method: "GET", path: /^\/api\/long-term-memory\/status$/, body: json(STATUS) },
  // Ordered before the list route only for readability; the patterns are
  // anchored, so `/notes/:id` and `/notes` cannot both match one request.
  { method: "GET", path: /^\/api\/long-term-memory\/notes\/([^/]+)$/, body: (m) => NOTES.find((n) => n.id === m[1]) },
  { method: "GET", path: /^\/api\/long-term-memory\/notes$/, body: json(NOTES) },
  { method: "GET", path: /^\/api\/long-term-memory\/drafts\/review$/, body: json(REVIEW) },
  // The kind is in the POST body, not the path: one route, three answers.
  {
    method: "POST", path: /^\/api\/long-term-memory\/import\/preview$/,
    body: (_m, request) => PREVIEWS[(request.postDataJSON() as { source?: string }).source ?? ""],
  },

  // The console's own state, served by server.mjs rather than the engine, so it
  // is not under /api. A key with nothing stored answers `{}`, not 404.
  { method: "GET", path: /^\/console\/state\/([a-z0-9-]+)$/, body: json({}) },
  { method: "PUT", path: /^\/console\/state\/([a-z0-9-]+)$/, body: json({ ok: true }) },
];

/** What a run could not answer. Empty is the only passing value. */
export interface ApiLog {
  unhandled: string[];
}

/**
 * Answer every request the console makes from the corpus.
 *
 * `extra` is prepended, so a test that needs one route to fail, to be slow, or
 * to answer differently states that one route and inherits the rest — which is
 * how the checks built on this harness extend the corpus without forking it.
 */
export async function installApi(page: Page, extra: Route[] = []): Promise<ApiLog> {
  const table = [...extra, ...ROUTES];
  const log: ApiLog = { unhandled: [] };

  await page.route(
    (url) => url.pathname.startsWith("/api/") || url.pathname.startsWith("/console/"),
    async (route, request) => {
      const { pathname } = new URL(request.url());
      const method = request.method();
      for (const entry of table) {
        if (entry.method !== method) continue;
        const match = entry.path.exec(pathname);
        if (!match) continue;
        const body = entry.body(match, request);
        // A matched route with no payload is a fixture gap, not an engine 404:
        // say so in the body, because that string is what a failing test prints.
        if (body === undefined) {
          log.unhandled.push(`${method} ${pathname} — matched, but the corpus has no record for it`);
          await route.fulfill({ status: 404, contentType: "application/json", body: '{"error":"not in the corpus"}' });
          return;
        }
        await route.fulfill({
          status: entry.status ?? 200,
          contentType: "application/json",
          headers: { "cache-control": "no-store" },
          body: JSON.stringify(body),
        });
        return;
      }
      log.unhandled.push(`${method} ${pathname}`);
      await route.fulfill({
        status: 501,
        contentType: "application/json",
        body: JSON.stringify({ error: `no fixture route for ${method} ${pathname}` }),
      });
    },
  );

  return log;
}
