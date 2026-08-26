// Answers every request the console makes, from tests/e2e/fixtures/.
//
// Gotcha: there is no /long-term-memory/sources route, however much the Sources
// screen looks like there should be. store/sources.ts assembles that screen from
// the three import previews, the notes list and the review response.
//
// An unmatched request is answered 501 and recorded, not left to fail; letting
// it fail reaches the app as an error state and blames the screen for a gap in
// this table. harness.ts asserts the recorded list is empty.

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
 * Answer every request the console makes from the corpus. `extra` is prepended,
 * so a test can override one route and inherit the rest.
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
