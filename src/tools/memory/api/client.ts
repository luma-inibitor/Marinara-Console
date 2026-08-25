// The one place a memory route names its schema.
//
// WIRE is the route census: every route this tool calls appears once, under
// exactly one of five kinds, and a route with no entry cannot be called at all
// — `call("GET /nope")` does not type-check. An omission is a hole you can see
// rather than a parse someone forgot to write.
//
//   list       an array read: a bad element is dropped and the rest arrive
//   one        an object read: a mismatch throws and the screen falls back
//   write      whole or not at all — the person was told the edit landed
//   unchecked  deliberately unparsed, and the reason is required in words
//   download   the browser fetches it; no payload crosses the console
//
// The reason on the last two is a string rather than a flag so that "on
// purpose" and "nobody has got to it yet" cannot look the same. That
// difference is the whole reason this is a table.

import * as v from "valibot";
import { api } from "../../../shell/api";
import { parseItems, parseWire, parseWrite } from "../../../shell/wire";
import { LTM } from "./routes";
import { AcceptResponseSchema, CharacterRowSchema, ChatSchema, ExtractResponseSchema, ImportPreviewSchema, ImportResultSchema, LtmStatusSchema, NoteArchiveSchema, NoteSchema, NoteWriteSchema, PreflightResponseSchema, ReviewResponseSchema, SkipResponseSchema } from "./schema";

type Schema = v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>;

/** `unwrap` normalises a reply before the schema sees it, for the routes that
 *  answer with more than one envelope. It belongs to the route rather than to
 *  the caller, which is the point. */
type Read = { unwrap?: (reply: unknown) => unknown };
type Entry = { path: string } & (
  | ({ list: Schema } & Read)
  | ({ one: Schema } & Read)
  | { write: Schema }
  | { unchecked: string }
  | { download: string }
);

const WIRE = {
  "GET /notes": { path: `${LTM}/notes`, list: NoteSchema },
  "GET /notes/:id": { path: `${LTM}/notes/:id`, one: NoteSchema },
  "PATCH /notes/:id": { path: `${LTM}/notes/:id`, write: NoteWriteSchema },
  "DELETE /notes/:id": { path: `${LTM}/notes/:id`, write: NoteArchiveSchema },
  "POST /notes/:id/extract": { path: `${LTM}/notes/:id/extract`, write: ExtractResponseSchema },

  "GET /drafts/review": { path: `${LTM}/drafts/review`, one: ReviewResponseSchema },
  "POST /drafts/:id/preflight": { path: `${LTM}/drafts/:id/preflight`, one: PreflightResponseSchema },
  "POST /drafts/:id/accept": { path: `${LTM}/drafts/:id/accept`, write: AcceptResponseSchema },
  "POST /drafts/:id/skip": { path: `${LTM}/drafts/:id/skip`, write: SkipResponseSchema },

  "POST /import/preview": { path: `${LTM}/import/preview`, one: ImportPreviewSchema },
  "POST /import/source-notes": { path: `${LTM}/import/source-notes`, write: ImportResultSchema },

  "GET /status": { path: `${LTM}/status`, one: LtmStatusSchema },
  "POST /rebuild": { path: `${LTM}/rebuild`, unchecked: "nothing reads the reply; the caller retakes /status after" },
  "GET /backup/export": { path: `${LTM}/backup/export`, download: "the browser downloads the file, so the vault never passes through the console" },

  "GET /chats": {
    path: "/chats",
    list: ChatSchema,
    unwrap: (r: unknown) => Array.isArray(r) ? r : (r as { items?: unknown }).items ?? [],
  },
  "GET /characters": {
    path: "/characters",
    list: CharacterRowSchema,
    unwrap: (r: unknown) => Array.isArray(r) ? r : [],
  },
} as const satisfies Record<string, Entry>;

type Table = typeof WIRE;
type Route = keyof Table;
type Download = { [K in Route]: Table[K] extends { download: string } ? K : never }[Route];

type Reply<K extends Route> =
  Table[K] extends { list: infer S extends Schema } ? v.InferOutput<S>[]
  : Table[K] extends { one: infer S extends Schema } ? v.InferOutput<S>
  : Table[K] extends { write: infer S extends Schema } ? v.InferOutput<S>
  : unknown;

/** The `:name` segments of a path, so a route with parameters cannot be called
 *  without them and a route without any cannot be handed some. */
type ParamName<P extends string> =
  P extends `${string}:${infer Rest}`
    ? Rest extends `${infer Name}/${infer Tail}` ? Name | ParamName<Tail> : Rest
    : never;

type Options<K extends Route> =
  ([ParamName<Table[K]["path"]>] extends [never]
    ? { params?: never }
    : { params: Record<ParamName<Table[K]["path"]>, string> })
  & { query?: Record<string, string | number>; body?: unknown };

type Args<K extends Route> =
  [ParamName<Table[K]["path"]>] extends [never] ? [opts?: Options<K>] : [opts: Options<K>];

const fill = (path: string, params: Record<string, string> = {}) =>
  path.replace(/:(\w+)/g, (_, name: string) => params[name]);

const search = (query: Record<string, string | number> = {}) => {
  const qs = new URLSearchParams(Object.entries(query).map(([k, val]) => [k, String(val)])).toString();
  return qs ? `?${qs}` : "";
};

export async function call<K extends Exclude<Route, Download>>(route: K, ...rest: Args<K>): Promise<Reply<K>> {
  const entry = WIRE[route] as Entry;
  const opts = (rest[0] ?? {}) as { params?: Record<string, string>; query?: Record<string, string | number>; body?: unknown };
  const method = route.slice(0, route.indexOf(" "));
  const reply = await api(
    fill(entry.path, opts.params) + search(opts.query),
    method === "GET" ? {} : { method, ...(opts.body !== undefined ? { body: opts.body } : {}) },
  );
  const context = `${method} ${entry.path}`;
  if ("list" in entry) return parseItems(entry.list, entry.unwrap ? entry.unwrap(reply) : reply, context) as Reply<K>;
  if ("one" in entry) return parseWire(entry.one, entry.unwrap ? entry.unwrap(reply) : reply, context) as Reply<K>;
  if ("write" in entry) return parseWrite(entry.write, reply, context) as Reply<K>;
  return reply as Reply<K>;
}

/** The address of a `download` route, for the browser to fetch on its own. */
export const urlFor = (route: Download): string => `/api${(WIRE[route] as Entry).path}`;
