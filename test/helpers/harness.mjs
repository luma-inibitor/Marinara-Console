// Plumbing for test/server.test.mjs: a real `node server.mjs` on an ephemeral
// port, a stub engine for it to proxy to, and a client that sends the request
// path verbatim.
//
// The verbatim path is the reason this file exists rather than a few lines of
// `fetch`. WHATWG URL parsing collapses `..` — and `%2e%2e` — before the bytes
// ever leave the client, so `fetch("http://host/%2e%2e/secret")` tests the URL
// parser, not the server. `http.request({ path })` writes the request line as
// given, which is what an attacker does.
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer, request as httpRequest } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const FIXTURES = join(ROOT, "test", "fixtures");

// A port the OS just handed out and does not have open any more. There is a
// window between the close and the child's listen, but nothing else in this
// suite competes for ports, and the alternative — parsing a port out of the
// server's startup log — needs a change to server.mjs that this pull request
// is not allowed to make.
async function freePort() {
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const { port } = probe.address();
  await new Promise((done) => probe.close(done));
  return port;
}

/**
 * One HTTP request, with the path sent exactly as written.
 * Returns the status, the headers, and the body as both text and bytes.
 */
export function req(base, path, { method = "GET", headers = {}, body } = {}) {
  const { hostname, port } = new URL(base);
  // Content-Length rather than chunked, because node's http client does not
  // frame a body on a DELETE unless one of the two headers says there is one:
  // it sends the request line, then writes the bytes after it, and the server
  // reads them as the start of a second request. Every method frames the same
  // way here, so a test can send the same body under any verb.
  if (body !== undefined && headers["content-length"] === undefined) {
    headers = { ...headers, "content-length": String(Buffer.byteLength(body)) };
  }
  return new Promise((resolve, reject) => {
    // `agent: false` is one connection per request. server.mjs answers 405 and
    // 400 without draining the request body, so node destroys that socket once
    // the response is out; on the shared keep-alive agent the NEXT test picks
    // up the dead socket and reads ECONNRESET. One connection per request also
    // means no test can be affected by the order of the tests before it.
    const r = httpRequest({ hostname, port, method, path, headers, agent: false }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const bytes = Buffer.concat(chunks);
        resolve({ status: res.statusCode, headers: res.headers, body: bytes.toString("utf8"), bytes });
      });
    });
    r.on("error", reject);
    if (body !== undefined) r.write(body);
    r.end();
  });
}

/**
 * A stand-in for the Marinara Engine. `handler(req, res, stub)` answers; every
 * request is recorded first, so a test can assert what the proxy sent as well
 * as what it returned.
 */
export async function startStub(handler) {
  const requests = [];
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const c of request) chunks.push(c);
    const record = {
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: Buffer.concat(chunks).toString("utf8"),
    };
    requests.push(record);
    await handler(request, response, record);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    url,
    requests,
    async close() {
      server.closeAllConnections?.();
      await new Promise((done) => server.close(done));
    },
  };
}

/**
 * `node server.mjs`, aimed at `target`, with the static roots aimed at the
 * fixture trees unless a test says otherwise.
 */
export async function startConsole({
  target = "http://127.0.0.1:1",
  // Named client/ and not dist/ because `dist/` in .gitignore matches at any
  // depth: called dist/, the fixture tree is untracked, and the suite passes
  // for whoever wrote it and fails in every fresh clone.
  dist = join(FIXTURES, "client"),
  pub = join(FIXTURES, "public"),
  env: extra = {},
} = {}) {
  const port = await freePort();
  const env = {
    ...process.env,
    PORT: String(port),
    HOST: "127.0.0.1",
    MARINARA_URL: target,
    MC_DIST: dist,
    MC_PUBLIC: pub,
  };
  // A secret in the developer's own shell would silently add a header to every
  // proxied request and turn the header assertions into a machine-dependent
  // result. A test that wants one passes it in `env`.
  delete env.MARINARA_ADMIN_SECRET;
  Object.assign(env, extra);

  const child = spawn(process.execPath, [join(ROOT, "server.mjs")], { env, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  child.stdout.on("data", (c) => (log += c));
  child.stderr.on("data", (c) => (log += c));

  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 10_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`server.mjs exited ${child.exitCode}:\n${log}`);
    try {
      await req(url, "/__config");
      break;
    } catch {
      if (Date.now() > deadline) throw new Error(`server.mjs never answered on ${port}:\n${log}`);
      await new Promise((r) => setTimeout(r, 25));
    }
  }

  return {
    url,
    get log() {
      return log;
    },
    request(path, opts) {
      return req(url, path, opts);
    },
    async close() {
      child.kill();
      await once(child, "exit");
    },
  };
}
