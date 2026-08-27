// The observable HTTP behaviour of server.mjs.
//
// Every assertion states what the server does TODAY, including where that is
// wrong; those cases are marked.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { precompress } from "../scripts/precompress.mjs";
import { FIXTURES, ROOT, startConsole, startStub } from "./helpers/harness.mjs";

// Gotcha: these two directories are not overridable and hold real data on a
// developer's machine. Record what was there first and remove only what we add.
const SCRATCH = [join(ROOT, ".state"), join(ROOT, ".backups")];
const preexisting = new Map();

const list = async (dir) => new Set(await readdir(dir).catch(() => []));

// A vector at the top, one an object deeper, one in an array, two non-vectors.
const ENTRIES = {
  entries: [
    { id: "a", embedding: [0.1, 0.2, 0.3], meta: { embedding: [], name: "nested" } },
    { id: "b", embedding: null, children: [{ embedding: [1] }, { embedding: "not-an-array" }] },
  ],
  count: 2,
};

// One entry carrying a vector of the size the engine really returns. The
// fixture above is too small to shrink — see the size test.
const BIG_ENTRY = { entries: [{ id: "big", embedding: Array.from({ length: 768 }, (_, i) => i / 1000) }] };

/** The stub engine. Its routes exist to make one proxy behaviour observable each. */
function engine(req, res) {
  const { pathname, search } = new URL(req.url, "http://engine.invalid");
  if (pathname === "/api/entries") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(ENTRIES));
    return;
  }
  if (pathname === "/api/entries-large") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(BIG_ENTRY));
    return;
  }
  if (pathname === "/api/text") {
    // A JSON-looking body under a content-type that is not JSON.
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end('{"embedding":[1,2,3]}');
    return;
  }
  if (pathname === "/api/export") {
    res.writeHead(200, { "content-type": "application/zip" });
    res.end(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff]));
    return;
  }
  if (pathname === "/api/no-content-type") {
    res.writeHead(200);
    res.end('{"embedding":[9]}');
    return;
  }
  if (pathname === "/api/empty") {
    res.writeHead(204, { "content-type": "application/json" });
    res.end("");
    return;
  }
  if (pathname === "/api/not-json") {
    res.writeHead(500, { "content-type": "application/json" });
    res.end("<html>gateway said no</html>");
    return;
  }
  if (pathname === "/api/long-term-memory/backup/export") {
    // Restore point unavailable: every LTM write reports the miss in a header.
    res.writeHead(503, { "content-type": "text/plain" });
    res.end("export unavailable");
    return;
  }
  res.writeHead(201, { "content-type": "application/json", "x-engine-header": "present" });
  res.end(JSON.stringify({ saw: pathname + search, method: req.method }));
}

let stub;
let mc;

beforeAll(async () => {
  for (const dir of SCRATCH) preexisting.set(dir, await list(dir));
  stub = await startStub(engine);
  mc = await startConsole({ target: stub.url });
}, 30_000);

afterAll(async () => {
  await mc?.close();
  await stub?.close();
  for (const dir of SCRATCH) {
    for (const name of await list(dir)) {
      if (!preexisting.get(dir).has(name)) await rm(join(dir, name), { force: true });
    }
  }
});

describe("/__config", () => {
  it("reports the engine the console is pointed at", async () => {
    const res = await mc.request("/__config");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(res.body)).toEqual({ target: stub.url });
  });
});

describe("static · dist at /", () => {
  it("serves index.html for the root", async () => {
    const res = await mc.request("/");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("text/html; charset=utf-8");
    expect(res.body).toContain("dist index");
  });

  it("serves index.html by name as well", async () => {
    const res = await mc.request("/index.html");
    expect(res.status).toBe(200);
    expect(res.body).toContain("dist index");
  });

  it("serves a nested asset", async () => {
    const res = await mc.request("/assets/app.js");
    expect(res.status).toBe(200);
    expect(res.body).toContain("dist app.js");
  });

  it("sends content-length and no-store with every file", async () => {
    const res = await mc.request("/assets/app.css");
    expect(res.headers["content-length"]).toBe(String(res.bytes.length));
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("404s an unknown path in plain text, with no SPA fallback to index.html", async () => {
    const res = await mc.request("/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toBe("text/plain");
    expect(res.body).toBe("Not found");
  });

  it("404s a directory that has no index.html, after redirecting to it", async () => {
    expect((await mc.request("/assets")).headers.location).toBe("/assets/");
    expect((await mc.request("/assets/")).status).toBe(404);
  });

  // Gotcha: nothing percent-decodes between `req.url` and `join()`, so a file
  // whose name needs escaping cannot be fetched. Vite emits none.
  it("does not percent-decode the path, so /index%2Ehtml misses", async () => {
    expect((await mc.request("/index%2Ehtml")).status).toBe(404);
  });
});

describe("static · MIME", () => {
  it.each([
    ["/index.html", "text/html; charset=utf-8"],
    ["/assets/app.js", "text/javascript; charset=utf-8"],
    ["/assets/app.css", "text/css; charset=utf-8"],
    ["/manifest.json", "application/json; charset=utf-8"],
    ["/assets/logo.svg", "image/svg+xml"],
  ])("%s is %s", async (path, type) => {
    expect((await mc.request(path)).headers["content-type"]).toBe(type);
  });

  // These two fell to application/octet-stream before the sirv rewrite, which
  // was wrong for both.
  it.each([
    ["/favicon.ico", "image/x-icon"],
    ["/notes.txt", "text/plain"],
  ])("%s is %s", async (path, type) => {
    expect((await mc.request(path)).headers["content-type"]).toBe(type);
  });
});

describe("static · public at /mockups/", () => {
  it("redirects /mockups to /mockups/", async () => {
    const res = await mc.request("/mockups");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/mockups/");
  });

  it("serves the mockup index from the public root", async () => {
    const res = await mc.request("/mockups/");
    expect(res.status).toBe(200);
    expect(res.body).toContain("mockups index");
  });

  it("redirects any mockup subdirectory to its slashed form and serves its index", async () => {
    const res = await mc.request("/mockups/detail");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/mockups/detail/");
    expect((await mc.request("/mockups/detail/")).body).toContain("mockups detail index");
  });

  // Both redirects build the Location from the path alone. A query string is
  // dropped on the way through. Nothing links to a mockup with a query today.
  it("drops the query string when it redirects", async () => {
    expect((await mc.request("/mockups?variant=2")).headers.location).toBe("/mockups/");
    expect((await mc.request("/mockups/detail?variant=2")).headers.location).toBe("/mockups/detail/");
  });

  // Gotcha: `new URL("//mockups/", base)` reads `mockups` as a HOST, so the
  // pathname is "/" and the server answers from dist.
  it("treats a doubled leading slash as a host and falls back to dist", async () => {
    const res = await mc.request("//mockups/");
    expect(res.status).toBe(200);
    expect(res.body).toContain("dist index");
  });
});

// ── one URL per file ──────────────────────────────────────────────
// sirv answers all of these 200 on its defaults, which the server turns off.
describe("static · one URL per file", () => {
  it.each([["/index"], ["/mockups/index"], ["/mockups/detail/index"]])(
    "404s the extensionless %s instead of resolving it to .html",
    async (path) => {
      const res = await mc.request(path);
      expect(res.status).toBe(404);
      expect(res.body).toBe("Not found");
    },
  );

  it.each([["/index.html/"], ["/assets/app.js/"], ["/mockups/index.html/"]])(
    "404s %s, because a trailing slash on a file is not the file",
    async (path) => {
      const res = await mc.request(path);
      expect(res.status).toBe(404);
      expect(res.body).toBe("Not found");
    },
  );

  it("still serves a directory index from the slashed form", async () => {
    expect((await mc.request("/")).body).toContain("dist index");
    expect((await mc.request("/mockups/")).body).toContain("mockups index");
    expect((await mc.request("/mockups/detail/")).body).toContain("mockups detail index");
  });
});

// ── path traversal ────────────────────────────────────────────────
// outside-root.txt sits one level above both static roots: any response
// carrying OUTSIDE-ROOT-MARKER is an escape.
describe("static · path traversal", () => {
  it.each([
    ["plain", "/../outside-root.txt"],
    ["plain, twice", "/../../outside-root.txt"],
    ["dot-slash prefix", "/./../outside-root.txt"],
    ["encoded dots", "/%2e%2e/outside-root.txt"],
    ["encoded slash", "/..%2foutside-root.txt"],
    ["encoded backslash", "/..%5coutside-root.txt"],
    ["double-encoded dots", "/%252e%252e/outside-root.txt"],
    ["four dots and a doubled slash", "/....//outside-root.txt"],
    ["absolute path", "//etc/hosts"],
    ["absolute path, rooted", "/etc/hosts"],
    ["null byte before the climb", "/%00../outside-root.txt"],
    ["null byte truncation", "/index.html%00.txt"],
    ["from the mockups root", "/mockups/../../outside-root.txt"],
    ["from the mockups root, encoded", "/mockups/%2e%2e/%2e%2e/outside-root.txt"],
    ["absolute-form request line", "http://localhost/../outside-root.txt"],
  ])("refuses to escape the static root: %s", async (_name, path) => {
    const res = await mc.request(path);
    expect(res.body).not.toContain("OUTSIDE-ROOT-MARKER");
    // 404, not 403: the URL parse resolves dot segments before anything else
    // sees them, so no request ever reaches a containment check.
    expect(res.status).toBe(404);
  });
});

describe("/console/state/:key · name validation", () => {
  // The regex `^[a-z0-9-]{1,60}$` in handleState is the second gate. The router
  // pattern `[a-z0-9-]+` is the first, and a name that fails THAT one is never
  // recognised as a state route at all — it falls through to the static handler
  // and 404s. Both refusals are correct; they do not look alike from outside.
  it.each([
    ["lowercase word", "ledger"],
    ["digits and dashes", "review-queue-2"],
    ["a single character", "x"],
    ["a bare dash", "-"],
    ["sixty characters", "a".repeat(60)],
  ])("accepts %s", async (_name, key) => {
    const res = await mc.request(`/console/state/${key}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/json");
  });

  it("rejects a name over sixty characters with 400 from the state handler", async () => {
    const res = await mc.request(`/console/state/${"a".repeat(61)}`);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body)).toEqual({ error: "bad state name" });
  });

  it.each([
    ["uppercase", "Ledger"],
    ["an underscore", "led_ger"],
    ["a dot", "led.ger"],
    ["a path separator", "led/ger"],
    ["an escaped space", "led%20ger"],
    ["nothing at all", ""],
  ])("does not route %s to the state handler at all — it 404s as static", async (_name, key) => {
    const res = await mc.request(`/console/state/${key}`);
    expect(res.status).toBe(404);
    expect(res.body).toBe("Not found");
  });
});

describe("/console/state/:key · documents", () => {
  const key = "conformance-doc";

  it("answers an empty object for a document that was never written", async () => {
    const res = await mc.request(`/console/state/${key}`);
    expect(res.status).toBe(200);
    expect(res.body).toBe("{}");
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("stores a PUT and reads it back byte for byte", async () => {
    const doc = JSON.stringify({ decisions: [{ id: "d1", kept: true }] });
    const put = await mc.request(`/console/state/${key}`, { method: "PUT", body: doc });
    expect(put.status).toBe(200);
    expect(JSON.parse(put.body)).toEqual({ ok: true });
    expect((await mc.request(`/console/state/${key}`)).body).toBe(doc);
  });

  it("refuses a malformed body and leaves the stored document alone", async () => {
    const res = await mc.request(`/console/state/${key}`, { method: "PUT", body: "{not json" });
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body)).toEqual({ error: "malformed state" });
    expect(JSON.parse((await mc.request(`/console/state/${key}`)).body)).toHaveProperty("decisions");
  });

  it("ignores the query string when it resolves the document", async () => {
    expect((await mc.request(`/console/state/${key}?t=1`)).body).toContain("decisions");
  });

  it.each(["POST", "DELETE", "PATCH"])("answers 405 with an empty body to %s", async (method) => {
    const res = await mc.request(`/console/state/${key}`, { method, body: "{}" });
    expect(res.status).toBe(405);
    expect(res.body).toBe("");
  });

  it("keys the file by engine target, so two engines keep two documents", async () => {
    const names = await readdir(join(ROOT, ".state"));
    const port = new URL(stub.url).port;
    expect(names).toContain(`${key}-http_127_0_0_1_${port}.json`);
  });
});

describe("/api/* · vector stripping", () => {
  it("replaces embedding with hasEmbedding at every depth, in objects and arrays", async () => {
    const res = await mc.request("/api/entries");
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      entries: [
        // A populated vector becomes true; the array itself is gone.
        { id: "a", hasEmbedding: true, meta: { hasEmbedding: false, name: "nested" } },
        // Anything that is not a non-empty array becomes false, including null
        // and a string. The key is dropped either way.
        { id: "b", hasEmbedding: false, children: [{ hasEmbedding: true }, { hasEmbedding: false }] },
      ],
      count: 2,
    });
    expect(res.body).not.toContain('embedding":[');
  });

  it("reports the upstream byte count in x-lbm-original-bytes", async () => {
    const res = await mc.request("/api/entries");
    // The header is the size of what the engine sent, not of what went out.
    // On this fixture the slimmed body is the LARGER of the two, because
    // `"hasEmbedding":false` costs more than `"embedding":null` — the header
    // is a measurement, not a promise that the response got smaller.
    expect(Number(res.headers["x-lbm-original-bytes"])).toBe(Buffer.byteLength(JSON.stringify(ENTRIES)));
    expect(res.headers["content-type"]).toBe("application/json; charset=utf-8");
    expect(res.headers["content-length"]).toBe(String(res.bytes.length));
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("drops a real vector to a boolean, which is the point of the whole proxy", async () => {
    const res = await mc.request("/api/entries-large");
    const original = Number(res.headers["x-lbm-original-bytes"]);
    expect(res.bytes.length).toBeLessThan(original / 10);
    expect(JSON.parse(res.body)).toEqual({ entries: [{ id: "big", hasEmbedding: true }] });
  });

  it("leaves a non-JSON content type alone even when the body is JSON", async () => {
    const res = await mc.request("/api/text");
    expect(res.headers["content-type"]).toBe("text/plain; charset=utf-8");
    expect(res.body).toBe('{"embedding":[1,2,3]}');
    expect(res.headers["x-lbm-original-bytes"]).toBeUndefined();
  });

  it("streams binary through untouched", async () => {
    const res = await mc.request("/api/export");
    expect(res.headers["content-type"]).toBe("application/zip");
    expect([...res.bytes]).toEqual([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff]);
  });

  it("treats a missing upstream content type as application/octet-stream and does not rewrite", async () => {
    const res = await mc.request("/api/no-content-type");
    expect(res.headers["content-type"]).toBe("application/octet-stream");
    expect(res.body).toBe('{"embedding":[9]}');
  });

  it("passes an empty JSON response through with its status", async () => {
    const res = await mc.request("/api/empty");
    expect(res.status).toBe(204);
    expect(res.body).toBe("");
  });

  it("passes a body that claims to be JSON but is not, with its status", async () => {
    const res = await mc.request("/api/not-json");
    expect(res.status).toBe(500);
    expect(res.body).toBe("<html>gateway said no</html>");
  });
});

describe("/api/* · forwarding", () => {
  it("forwards method, path, query and body, and returns the upstream status", async () => {
    const res = await mc.request("/api/notes?limit=5&q=a%20b", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"text":"hi"}',
    });
    expect(res.status).toBe(201);
    expect(JSON.parse(res.body)).toEqual({ saw: "/api/notes?limit=5&q=a%20b", method: "POST" });
    const sent = stub.requests.at(-1);
    expect(sent.body).toBe('{"text":"hi"}');
    expect(sent.headers["content-type"]).toBe("application/json");
  });

  it("sends the engine an Origin it trusts and asks for JSON", async () => {
    await mc.request("/api/notes");
    const sent = stub.requests.at(-1);
    expect(sent.headers.origin).toBe(stub.url);
    expect(sent.headers.accept).toBe("application/json");
  });

  it("sends no admin secret when the environment has none", async () => {
    await mc.request("/api/notes");
    expect(stub.requests.at(-1).headers["x-admin-secret"]).toBeUndefined();
  });

  // Only content-type crosses back. An upstream Set-Cookie, ETag or
  // Content-Disposition is dropped, which the console has never needed and a
  // general-purpose proxy would not do. Wave 4 may well start forwarding them.
  it("returns none of the engine's other response headers", async () => {
    const res = await mc.request("/api/notes");
    expect(res.headers["x-engine-header"]).toBeUndefined();
  });

  // /api/ with the slash. `/api` alone is not a prefix match, so it is served —
  // and missed — as a static file.
  it("only proxies below /api/", async () => {
    expect((await mc.request("/api")).status).toBe(404);
    expect(stub.requests.at(-1).url).not.toBe("/api");
  });
});

describe("/api/* · engine unreachable", () => {
  it("answers 502 naming the target instead of hanging or throwing", async () => {
    // Port 1 is privileged and nothing is listening on it, so the connection is
    // refused immediately rather than timing out.
    const offline = await startConsole({ target: "http://127.0.0.1:1" });
    try {
      const res = await offline.request("/api/anything");
      expect(res.status).toBe(502);
      const payload = JSON.parse(res.body);
      expect(payload.error).toBe("Cannot reach engine at http://127.0.0.1:1");
      expect(payload.detail).toBeTruthy();
    } finally {
      await offline.close();
    }
  }, 30_000);
});

describe("/api/long-term-memory/* · restore point", () => {
  // The stub's export route answers 503, so the restore point always fails and
  // every attempt is visible as `x-ltm-restore-point: failed`. The header is
  // therefore a readout of the isLtmWrite predicate, which is not exported and
  // cannot be called directly.
  const attempted = (res) => res.headers["x-ltm-restore-point"] === "failed";

  it.each([
    ["POST", "/api/long-term-memory/notes", true],
    ["PUT", "/api/long-term-memory/notes/1", true],
    ["PATCH", "/api/long-term-memory/notes/1", true],
    ["DELETE", "/api/long-term-memory/notes/1", true],
    // Reads in POST clothing. Each of these computes something and returns it;
    // none of them changes the store, and taking a restore point before every
    // keystroke of a search box would be both slow and useless.
    ["POST", "/api/long-term-memory/search", false],
    ["POST", "/api/long-term-memory/notes/preflight", false],
    ["POST", "/api/long-term-memory/import/preview", false],
    ["POST", "/api/long-term-memory/rename-preview", false],
    ["POST", "/api/long-term-memory/transfer-preview", false],
    // Reads.
    ["GET", "/api/long-term-memory/notes", false],
    ["HEAD", "/api/long-term-memory/notes", false],
    // Not a read and not a write: the predicate is "anything that is not GET
    // or HEAD", so a CORS preflight would pull a whole backup export. The
    // console is same-origin with the proxy, so no browser sends one today.
    ["OPTIONS", "/api/long-term-memory/notes", true],
    // Not the long-term memory store at all.
    ["POST", "/api/prompts/1", false],
    ["POST", "/api/long-term-memoryx/notes", false],
  ])("%s %s takes a restore point first: %s", async (method, path, expected) => {
    const res = await mc.request(path, { method, body: method === "GET" || method === "HEAD" ? undefined : "{}" });
    expect(attempted(res)).toBe(expected);
  });

  // The exclusion is anchored at the end of the path, so a route that merely
  // starts with one of those words is a write. `previewx` is not `preview`.
  it("only excludes the preview words as a whole final segment", async () => {
    expect(attempted(await mc.request("/api/long-term-memory/previewx", { method: "POST", body: "{}" }))).toBe(true);
    expect(attempted(await mc.request("/api/long-term-memory/preview", { method: "POST", body: "{}" }))).toBe(false);
  });

  it("fails open: the write still reaches the engine when the export route is down", async () => {
    const res = await mc.request("/api/long-term-memory/notes", { method: "POST", body: '{"text":"x"}' });
    expect(res.status).toBe(201);
    expect(stub.requests.at(-1).body).toBe('{"text":"x"}');
  });

  it("takes one restore point per run, keeps the export's file type, and does not repeat it", async () => {
    // A second console, aimed at an engine whose export route works. The file
    // lands in .backups/ beside server.mjs — the path is not overridable — and
    // afterAll removes what this test added.
    const ok = await startStub((req, res) => {
      if (req.url === "/api/long-term-memory/backup/export") {
        res.writeHead(200, { "content-type": "application/zip" });
        res.end(Buffer.from("PK backup bytes"));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end("{}");
    });
    const console2 = await startConsole({ target: ok.url });
    try {
      const first = await console2.request("/api/long-term-memory/notes", { method: "POST", body: "{}" });
      const second = await console2.request("/api/long-term-memory/notes", { method: "POST", body: "{}" });
      expect(first.headers["x-ltm-restore-point"]).toBeUndefined();
      expect(second.headers["x-ltm-restore-point"]).toBeUndefined();
      expect(ok.requests.filter((r) => r.url === "/api/long-term-memory/backup/export")).toHaveLength(1);

      const added = [...(await list(SCRATCH[1]))].filter((n) => !preexisting.get(SCRATCH[1]).has(n));
      expect(added.filter((n) => n.startsWith("ltm-backup-") && n.endsWith(".zip"))).toHaveLength(1);
      expect(console2.log).toContain("ltm restore point:");
    } finally {
      await console2.close();
      await ok.close();
    }
  }, 30_000);
});

describe("static roots", () => {
  // The one change this pull request makes to server.mjs. Without it the suite
  // would have to run against a real build, which would make every static
  // assertion depend on whatever vite last emitted.
  it("takes both static roots from MC_DIST and MC_PUBLIC", async () => {
    const dist = await mc.request("/manifest.json");
    expect(JSON.parse(dist.body)).toEqual({ marker: "dist manifest.json" });
    expect((await mc.request("/mockups/")).body).toContain("mockups index");
  });
});

// ── precompressed siblings ────────────────────────────────────────
// A temporary copy of the fixture tree, run through scripts/precompress.mjs.
// Compressed fixtures are not committed: generating them here proves the script
// and the server agree, which a checked-in blob could not.
describe("static · precompressed siblings", () => {
  const HASHED = "/assets/index-abcd1234.js";
  const PLAIN = "/assets/app.js";
  let tree;
  let body;
  let server;

  beforeAll(async () => {
    tree = await mkdtemp(join(tmpdir(), "mc-dist-"));
    await cp(join(FIXTURES, "client"), tree, { recursive: true });
    // Over the script's floor, and repetitive so both encodings beat it.
    body = `globalThis.marker = "${"dist,hashed,asset;".repeat(200)}";\n`;
    await mkdir(join(tree, "assets"), { recursive: true });
    await writeFile(join(tree, HASHED.slice(1)), body);
    await mkdir(join(tree, "downloads"), { recursive: true });
    await writeFile(join(tree, "downloads", "data.tar.gz"), "a genuine download");
    precompress(tree);
    server = await startConsole({ dist: tree });
  });

  afterAll(async () => {
    await server?.close();
    await rm(tree, { recursive: true, force: true });
  });

  const get = (path, encoding) => server.request(path, { headers: { "accept-encoding": encoding } });

  it("sends brotli, and the bytes decode back to the file", async () => {
    const res = await get(HASHED, "br");
    expect(res.headers["content-encoding"]).toBe("br");
    expect(res.headers["vary"]).toBe("Accept-Encoding");
    expect(brotliDecompressSync(res.bytes).toString("utf8")).toBe(body);
  });

  it("sends gzip to a client that asks for gzip alone", async () => {
    const res = await get(HASHED, "gzip");
    expect(res.headers["content-encoding"]).toBe("gzip");
    expect(gunzipSync(res.bytes).toString("utf8")).toBe(body);
  });

  it("prefers brotli when a client offers both", async () => {
    expect((await get(HASHED, "gzip, br")).headers["content-encoding"]).toBe("br");
  });

  it("sends the file itself to a client that asks for no encoding", async () => {
    const res = await get(HASHED, "");
    expect(res.headers["content-encoding"]).toBeUndefined();
    expect(res.body).toBe(body);
  });

  // The sibling is a different file, so its type would come from `.br` if the
  // server read the name it opened rather than the name it was asked for.
  it("types the reply by the file that was asked for, not by the sibling", async () => {
    expect((await get(HASHED, "br")).headers["content-type"]).toBe("text/javascript; charset=utf-8");
  });

  it("still marks a hashed asset immutable when it sends the sibling", async () => {
    expect((await get(HASHED, "br")).headers["cache-control"]).toBe("public,max-age=31536000,immutable");
  });

  // app.js is under the script's floor, so it has no sibling to send.
  it("sends the file itself where no sibling was written", async () => {
    const res = await get(PLAIN, "br, gzip");
    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBeUndefined();
    expect(res.headers["content-type"]).toBe("text/javascript; charset=utf-8");
  });

  // Without this a shared cache could hand compressed bytes to a client that
  // never asked for them.
  it("varies on the request encoding even where there is no sibling", async () => {
    expect((await get(PLAIN, "br")).headers["vary"]).toBe("Accept-Encoding");
  });

  it("404s a sibling asked for by name, so there is one URL per file", async () => {
    expect((await get(`${HASHED}.br`, "")).status).toBe(404);
  });

  // Served, sirv would send this with `content-encoding: gzip` that the client
  // never asked for, and the browser would unpack it under its packed name.
  it("404s a name that merely ends in .gz rather than serving it wrong", async () => {
    expect((await get("/downloads/data.tar.gz", "")).status).toBe(404);
  });
});
