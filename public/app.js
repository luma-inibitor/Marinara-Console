// Lorebook Mobile — audit console for Marinara Engine lorebooks.
//
// Reads through server.mjs, which strips embedding vectors on the way past.
// Activation verdicts come from lib/lorebook-keyword-matching.js, vendored
// verbatim from packages/shared so the preview cannot drift from a real scan.
//
// UI copy is taken from the engine's own en.json wherever an equivalent string
// exists, so the two apps name the same things the same way.

import { testPrimaryKeys, testSecondaryKeys } from "./lib/lorebook-keyword-matching.js";

// ── engine vocabulary ─────────────────────────────────────────────
// deriveStatus()/STATUS_LABEL/STATUS_DOT_COLOR in LorebookEntryRow.tsx.
const STATUS_LABEL = { normal: "Normal", constant: "Constant", selective: "Selective", disabled: "Disabled" };
const STATUS_HINT = {
  normal: "Triggers when primary keys match the scanned text.",
  constant: "Injects every time this lorebook is active.",
  selective: "Primary keys must match with the secondary-key logic.",
  disabled: "Never injected while disabled.",
};
// lorebookentryrow.beforeCompact / afterCompact / depthCompact / outlet
const POS_COMPACT = { 0: "↑Char", 1: "↓Char", 2: "@Depth", 7: "Outlet" };
const POS_FULL = {
  0: "Before character definitions", 1: "After character definitions",
  2: "@ Depth", 7: "Outlet",
};
const UNTAGGED = " untagged";
// approximateTokens() in packages/shared/src/utils/agent-cost.ts
const tokensOf = (text) => Math.ceil((text ?? "").length / 4);

const ADVANCED_FIELDS = [
  ["selectiveLogic", "and"], ["probability", null], ["scanDepth", null],
  ["matchWholeWords", false], ["caseSensitive", false], ["useRegex", false],
  ["sticky", null], ["cooldown", null], ["delay", null], ["ephemeral", null],
  ["group", ""], ["groupWeight", null], ["locked", false],
  ["preventRecursion", false], ["excludeRecursion", false], ["delayUntilRecursion", false],
  ["excludeFromVectorization", false], ["role", "system"],
  ["characterFilterMode", "any"], ["characterTagFilterMode", "any"],
  ["generationTriggerFilterMode", "any"],
];

const SUBS = ["keys", "description", "content", "trigger", "advanced", "name"];

// ── state ─────────────────────────────────────────────────────────
const S = {
  books: [], book: null, entries: [],
  sort: "tokens", group: false, flaggedOnly: false,
  mode: "find", query: "",
  open: new Set(), sub: new Set(), selecting: false, selected: new Set(),
  p90: 0, kp90: 0,
};

const $ = (s) => document.querySelector(s);
const html = document.documentElement;
const screen = (n) => html.setAttribute("data-screen", n);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ── api ───────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const res = await fetch("/api" + path, {
    ...opts,
    headers: opts.body ? { "content-type": "application/json" } : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json())?.error ?? ""; } catch { /* not json */ }
    throw new Error(`${res.status} ${res.statusText}${detail ? ` — ${detail}` : ""}`);
  }
  return res.status === 204 ? null : res.json();
}

let toastTimer;
function toast(msg, isError = false) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.toggle("err", isError);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, isError ? 5200 : 2200);
}

// ── derived ───────────────────────────────────────────────────────
function decorate(e) {
  e._tokens = tokensOf(e.content);
  e._descTokens = tokensOf(e.description);
  e._tag = (e.tag ?? "").trim();
  e._status = !e.enabled ? "disabled" : e.constant ? "constant" : e.selective ? "selective" : "normal";
  return e;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}
function recomputeThresholds() {
  S.p90 = percentile(S.entries.map((e) => e._tokens), 0.9);
  S.kp90 = percentile(S.entries.map((e) => e.keys.length), 0.9);
}
const isFlagged = (e) => e._tokens > S.p90 || e.keys.length > S.kp90;

function evaluate(e) {
  if (S.mode !== "test" || !S.query.trim()) return { fires: false, hits: [], tested: false };
  if (!e.enabled) return { fires: false, hits: [], tested: true };
  if (e.constant) return { fires: true, hits: [], tested: true };
  const opts = {
    useRegex: !!e.useRegex, matchWholeWords: !!e.matchWholeWords, caseSensitive: !!e.caseSensitive,
  };
  const { matched, matchedKeys } = testPrimaryKeys(e.keys ?? [], S.query, opts);
  if (!matched) return { fires: false, hits: [], tested: true };
  const ok = !e.selective
    || testSecondaryKeys(e.secondaryKeys ?? [], S.query, e.selectiveLogic ?? "and", opts);
  return { fires: ok, hits: matchedKeys, tested: true };
}

function matchesQuery(e) {
  const q = S.query.trim().toLowerCase();
  if (!q) return true;
  return (e.name ?? "").toLowerCase().includes(q)
    || (e.content ?? "").toLowerCase().includes(q)
    || (e.description ?? "").toLowerCase().includes(q)
    || (e.keys ?? []).some((k) => k.toLowerCase().includes(q))
    || (e._tag ?? "").toLowerCase().includes(q);
}

function visibleEntries() {
  let list = S.entries.map((e) => ({ ...e, _ev: evaluate(e) }));
  if (S.mode === "find") list = list.filter(matchesQuery);
  if (S.flaggedOnly) list = list.filter(isFlagged);
  const cmp = {
    tokens: (a, b) => b._tokens - a._tokens,
    order: (a, b) => a.order - b.order,
    keys: (a, b) => b.keys.length - a.keys.length,
    name: (a, b) => (a.name ?? "").localeCompare(b.name ?? ""),
    updated: (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
  }[S.sort];
  list.sort((a, b) => (S.mode === "test" ? (b._ev.fires ? 1 : 0) - (a._ev.fires ? 1 : 0) : 0) || cmp(a, b));
  return list;
}

function tagStats() {
  const map = new Map();
  for (const e of S.entries) {
    const key = e._tag || UNTAGGED;
    const s = map.get(key) ?? { tag: key, n: 0, tokens: 0, constant: 0, disabled: 0 };
    s.n++; s.tokens += e._tokens;
    if (e.constant) s.constant++;
    if (!e.enabled) s.disabled++;
    map.set(key, s);
  }
  return [...map.values()].sort((a, b) => b.n - a.n);
}

// ── boot ──────────────────────────────────────────────────────────
async function boot() {
  screen("boot");
  $("#bootmsg").textContent = "Reaching engine…";
  $("#retry").hidden = true;
  try {
    const cfg = await (await fetch("/__config")).json();
    $("#bootsub").textContent = cfg.target;
    const [health, books] = await Promise.all([api("/health"), api("/lorebooks")]);
    S.books = books;
    $("#picksub").textContent =
      `${books.length} lorebooks · engine ${health.version} · ${health.fork?.branch ?? "stock"}`;
    renderPicker();
    screen("pick");
  } catch (err) {
    $("#bootmsg").textContent = "Cannot reach engine";
    $("#bootsub").textContent = String(err.message ?? err);
    $("#retry").hidden = false;
  }
}

function renderPicker() {
  $("#picker").innerHTML = S.books.map((b) => {
    const over = b._sum > b.tokenBudget;
    const n = b._n;
    return `<button class="book" data-act="open-book" data-id="${esc(b.id)}">
      <div class="bt">${esc(b.name)}</div>
      <div class="bs">
        <span><b>${n ?? "—"}</b> ${n === 1 ? "entry" : "entries"}</span>
        <span><b>${b._constant ?? 0}</b> constant</span>
        <span class="${over ? "warn" : ""}"><b>${(b._sum ?? 0).toLocaleString()}</b> / ${b.tokenBudget.toLocaleString()} tokens (est.)</span>
        ${b.enabled ? "" : '<span style="color:var(--flag)">disabled</span>'}
      </div>
      <div class="pb"><i style="display:block;height:100%;width:${Math.min(100, ((b._sum ?? 0) / b.tokenBudget) * 100)}%;background:${over ? "var(--flag)" : "var(--normal)"}"></i></div>
    </button>`;
  }).join("");
}

async function hydratePickerStats() {
  await Promise.all(S.books.map(async (b) => {
    try {
      const entries = await api(`/lorebooks/${b.id}/entries`);
      b._n = entries.length;
      b._constant = entries.filter((e) => e.constant && e.enabled).length;
      b._sum = entries.reduce((a, e) => a + tokensOf(e.content), 0);
    } catch { b._n = "?"; }
  }));
  if (html.getAttribute("data-screen") === "pick") renderPicker();
}

async function openBook(id) {
  S.book = S.books.find((b) => b.id === id);
  S.open.clear(); S.sub.clear(); S.selected.clear(); S.selecting = false;
  $("#bookname").textContent = S.book.name;
  screen("list");
  $("#rows").innerHTML = '<p class="empty">Loading lorebook entries…</p>';
  try {
    S.entries = (await api(`/lorebooks/${id}/entries`)).map(decorate);
    recomputeThresholds();
    render();
  } catch (err) {
    $("#rows").innerHTML = `<p class="empty">These lorebook entries could not be loaded.<br>${esc(err.message)}</p>`;
  }
}

// ── render ────────────────────────────────────────────────────────
function render() {
  renderMeter();
  renderRows();
  $("#flagn").textContent = S.entries.filter(isFlagged).length;
  $("#selbar").hidden = !S.selecting;
  $("#sortbar").hidden = S.selecting;
  $("#selcount").textContent = `${S.selected.size} selected`;
  for (const b of document.querySelectorAll("[data-act='sort']")) {
    b.setAttribute("aria-pressed", String(b.dataset.key === S.sort && !S.group));
  }
  $("[data-act='group']").setAttribute("aria-pressed", String(S.group));
  $("[data-act='flagged']").setAttribute("aria-pressed", String(S.flaggedOnly));
}

function renderMeter() {
  const budget = S.book?.tokenBudget || 1;
  const testing = S.mode === "test" && S.query.trim();
  const pool = testing
    ? S.entries.filter((e) => evaluate(e).fires)
    : S.entries.filter((e) => e.enabled);
  const aTok = pool.filter((e) => e.constant).reduce((a, e) => a + e._tokens, 0);
  const kTok = pool.filter((e) => !e.constant).reduce((a, e) => a + e._tokens, 0);
  const total = aTok + kTok;
  const over = total > budget;
  const pct = (n) => Math.max(0, Math.min(100, (n / budget) * 100));

  $("#res").textContent = testing
    ? `${pool.length} match`
    : (S.query.trim() ? `${visibleEntries().length} match` : "");

  $("#meter").innerHTML = `
    <span class="lab ml">${testing ? "Would activate" : "All active"}</span>
    <span class="bar">
      <span class="a" style="width:${pct(aTok)}%"></span>
      <span class="k" style="width:${Math.min(pct(kTok), 100 - pct(aTok))}%"></span>
      ${over ? `<span class="o" style="width:${Math.min(70, ((total - budget) / budget) * 100)}%"></span>` : ""}
    </span>
    <span class="mval"><span class="${over ? "over" : ""}">${total.toLocaleString()}</span><span class="of"> / ${budget.toLocaleString()}</span></span>`;
}

function rowHTML(e, index, total) {
  const open = S.open.has(e.id);
  const sel = S.selected.has(e.id);
  const hotT = e._tokens > S.p90;
  const hotK = e.keys.length > S.kp90;
  const ev = e._ev ?? { fires: false, hits: [], tested: false };

  // The status circle already says "constant" — the meta line never repeats it.
  const bits = [];
  if (ev.tested && ev.fires) bits.push('<span class="act">Would activate</span>');
  bits.push(`<span class="tag${e._tag ? "" : " none"}">${esc(e._tag || "untagged")}</span>`);
  if (e.position !== 0) bits.push(esc(POS_COMPACT[e.position] ?? ""));
  if (!e.constant && !e.keys.length) bits.push('<span class="warn">no keys</span>');
  else if (e.keys.length) {
    bits.push(e.keys.slice(0, 6)
      .map((k) => (ev.hits.includes(k) ? `<span class="hit">${esc(k)}</span>` : esc(k)))
      .join("<i>·</i>"));
  }

  return `<article class="row${open ? " open" : ""}${sel ? " sel" : ""}${ev.tested && !ev.fires ? " idle" : ""}" data-s="${e._status}" data-id="${esc(e.id)}">
    <button class="summary" data-act="toggle" data-id="${esc(e.id)}" aria-expanded="${open}">
      <span class="rail"><span class="dot"></span><span class="ord">${e.order}</span></span>
      <span class="mid">
        <span class="nm">${esc(e.name) || "Untitled entry"}</span>
        <span class="meta">${bits.join('<i>·</i>')}</span>
      </span>
      <span class="num">
        <b class="tok${hotT ? " hot" : ""}">${e._tokens}</b>
        <b class="kc${hotK ? " hot" : ""}">${e.keys.length} keys</b>
      </span>
    </button>
    ${open ? drawerHTML(e, index, total) : ""}
  </article>`;
}

/** One collapsible sub-row: label, a summary of what is inside, and the body. */
function subRow(e, id, label, summary, body) {
  const open = S.sub.has(`${e.id}:${id}`);
  return `<div class="sub${open ? " open" : ""}">
    <button class="subhead" data-act="sub" data-id="${esc(e.id)}" data-sub="${id}" aria-expanded="${open}">
      <span class="sl">${label}</span>
      <span class="sv">${summary}</span>
      <span class="cv">${open ? "▴" : "▾"}</span>
    </button>
    ${open ? `<div class="subbody">${body()}</div>` : ""}
  </div>`;
}

function drawerHTML(e, index, total) {
  const ev = e._ev ?? { hits: [] };
  const advNonDefault = ADVANCED_FIELDS.filter(([f, d]) =>
    e[f] !== undefined && JSON.stringify(e[f]) !== JSON.stringify(d));

  const keySummary = e.keys.length
    ? `<b>${e.keys.length}</b> · ${esc(e.keys.slice(0, 3).join(", "))}${e.keys.length > 3 ? "…" : ""}`
    : '<span class="warn">none</span>';

  const posLabel = e.position === 2 ? `@ Depth ${e.depth}`
    : e.position === 7 ? `Outlet ${e.outletName || "—"}`
    : POS_FULL[e.position];

  return `<div class="drawer">
    ${subRow(e, "keys", "Primary Keys", keySummary, () => `
      <div class="kchips">
        ${e.keys.map((k, i) => `<span class="kchip${ev.hits.includes(k) ? " hit" : ""}"><span class="kt">${esc(k)}</span><button class="x" data-act="key-del" data-id="${esc(e.id)}" data-i="${i}" aria-label="Remove ${esc(k)}">×</button></span>`).join("")}
        <button class="kadd" data-act="key-add" data-id="${esc(e.id)}">＋</button>
      </div>`)}

    ${subRow(e, "description", "Description",
      `<b>${(e.description ?? "").length}</b> ch · <b>${e._descTokens}</b> tokens`, () => `
      <div class="fieldbar"><button class="expand" data-act="expand" data-id="${esc(e.id)}" data-field="description"><span class="ic">⤢</span>Edit Description</button></div>
      <textarea class="ta" rows="4" data-field="description" data-id="${esc(e.id)}" placeholder="Brief summary for routing.">${esc(e.description)}</textarea>`)}

    ${subRow(e, "content", "Content",
      `<b>${(e.content ?? "").length}</b> ch · <b>${e._tokens}</b> tokens`, () => `
      <div class="fieldbar"><button class="expand" data-act="expand" data-id="${esc(e.id)}" data-field="content"><span class="ic">⤢</span>Edit Content</button></div>
      <textarea class="ta md" rows="7" data-field="content" data-id="${esc(e.id)}">${esc(e.content)}</textarea>`)}

    ${subRow(e, "trigger", "Trigger & Position",
      `<span class="st">${STATUS_LABEL[e._status]}</span> · ${esc(POS_COMPACT[e.position] ?? "")} · Order <b>${e.order}</b>`, () => `
      <div class="trig">
        ${["disabled", "normal", "constant", "selective"].map((v) =>
          `<button class="tbtn" data-act="status" data-id="${esc(e.id)}" data-v="${v}" aria-pressed="${e._status === v}"><span class="d"></span>${STATUS_LABEL[v]}</button>`).join("")}
      </div>
      <p class="hint">${STATUS_HINT[e._status]}</p>
      <div class="posgrid">
        ${[0, 1, 2, 7].map((p) =>
          `<button class="pbtn" data-act="pos" data-id="${esc(e.id)}" data-v="${p}" aria-pressed="${e.position === p}">${POS_COMPACT[p]}</button>`).join("")}
      </div>
      <div class="movebar">
        <button data-act="order" data-id="${esc(e.id)}" data-d="-10" aria-label="Lower order">−</button>
        <span class="slot"><span class="v">${e.order}</span><span class="c">${index + 1} of ${total} · ${esc(posLabel)}</span></span>
        <button data-act="order" data-id="${esc(e.id)}" data-d="10" aria-label="Raise order">＋</button>
      </div>`)}

    ${subRow(e, "advanced", "Advanced",
      advNonDefault.length ? `<b>${advNonDefault.length}</b> changed` : "all default", () => `
      ${ADVANCED_FIELDS.map(([f, d]) => {
        const nd = e[f] !== undefined && JSON.stringify(e[f]) !== JSON.stringify(d);
        return `<div class="advrow${nd ? " nd" : ""}"><span class="an">${f}</span><span class="av">${esc(JSON.stringify(e[f] ?? d))}</span></div>`;
      }).join("")}
      <div class="advrow"><span class="an">secondaryKeys</span><span class="av">${esc(JSON.stringify(e.secondaryKeys ?? []))}</span></div>
      <div class="advrow"><span class="an">vector</span><span class="av">${e.hasEmbedding ? "yes" : "No Vector"}</span></div>
      <div class="advrow"><span class="an">updated</span><span class="av">${esc((e.updatedAt ?? "").slice(0, 16).replace("T", " "))}</span></div>
      <button class="dangerbtn" data-act="delete" data-id="${esc(e.id)}">Delete entry</button>`)}

    ${subRow(e, "name", "Name",
      `<span class="savepill" data-pill="${esc(e.id)}">Saved automatically</span>`, () => `
      <input class="tin" data-field="name" data-id="${esc(e.id)}" value="${esc(e.name)}" placeholder="Untitled entry">`)}
  </div>`;
}

function renderRows() {
  const list = visibleEntries();
  const rows = $("#rows");
  if (!list.length) {
    rows.innerHTML = `<p class="empty">${S.mode === "test"
      ? "No entries would activate on this text."
      : "No entries match your search"}</p>`;
    return;
  }
  if (!S.group) {
    rows.innerHTML = list.map((e, i) => rowHTML(e, i, list.length)).join("");
    return;
  }
  const groups = new Map();
  for (const e of list) {
    const k = e._tag || UNTAGGED;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  rows.innerHTML = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([tag, items]) => {
      const tk = items.reduce((a, e) => a + e._tokens, 0);
      return `<div class="grouphead">
          <span class="gn">${esc(tag === UNTAGGED ? "untagged" : tag)}</span>
          <span class="gs">${items.length} · ${tk.toLocaleString()}t</span>
          <button class="gsel" data-act="sel-tag-all" data-tag="${esc(tag)}">Select</button>
        </div>${items.map((e, i) => rowHTML(e, i, items.length)).join("")}`;
    }).join("");
}

function renderTags() {
  const stats = tagStats();
  const max = Math.max(...stats.map((s) => s.n), 1);
  $("#tagsub").textContent = `${stats.length} · ${S.entries.length} entries`;
  $("#taglist").innerHTML = stats.map((s) => `<div class="trow">
      <div>
        <div class="tn${s.tag === UNTAGGED ? " none" : ""}">${esc(s.tag === UNTAGGED ? "untagged" : s.tag)}</div>
        <div class="tstat">${s.n} ${s.n === 1 ? "entry" : "entries"} · ${s.tokens.toLocaleString()} tokens (est.)${s.constant ? ` · ${s.constant} constant` : ""}${s.disabled ? ` · ${s.disabled} disabled` : ""}</div>
      </div>
      <div class="tacts">
        <button data-act="tag-filter" data-tag="${esc(s.tag)}">Show</button>
        <button data-act="tag-select" data-tag="${esc(s.tag)}">Select</button>
      </div>
      <div class="tbar"><i style="display:block;height:100%;width:${(s.n / max) * 100}%;background:var(--accent);opacity:.65"></i></div>
    </div>`).join("");
}

// ── saving ────────────────────────────────────────────────────────
const timers = new Map();
function pill(id, state, text) {
  const el = document.querySelector(`[data-pill="${CSS.escape(id)}"]`);
  if (el) { el.className = `savepill ${state}`; el.textContent = text; }
}

/** Field-level PATCH — never sends a field the user did not touch. */
async function save(id, patch, { immediate = false } = {}) {
  const entry = S.entries.find((x) => x.id === id);
  if (!entry) return;
  Object.assign(entry, patch);
  decorate(entry);
  pill(id, "dirty", "Autosaving…");
  clearTimeout(timers.get(id));

  const run = async () => {
    timers.delete(id);
    try {
      const updated = await api(`/lorebooks/${S.book.id}/entries/${id}`, {
        method: "PATCH", body: JSON.stringify(patch),
      });
      if (updated) Object.assign(entry, decorate(updated));
      pill(id, "saved", "Saved automatically");
      recomputeThresholds();
      renderMeter();
      $("#flagn").textContent = S.entries.filter(isFlagged).length;
    } catch (err) {
      pill(id, "err", "Failed to save");
      toast(`Failed to save entry: ${err.message}`, true);
    }
  };
  if (immediate) await run();
  else timers.set(id, setTimeout(run, 700));
}

async function bulk(changes) {
  const ids = [...S.selected];
  if (!ids.length) return toast("Nothing selected", true);
  try {
    await api(`/lorebooks/${S.book.id}/entries/bulk`, {
      method: "PATCH", body: JSON.stringify({ entryIds: ids, changes }),
    });
    S.entries = (await api(`/lorebooks/${S.book.id}/entries`)).map(decorate);
    recomputeThresholds();
    toast(`Updated ${ids.length} ${ids.length === 1 ? "entry" : "entries"}`);
    render();
  } catch (err) {
    toast(`Failed to update the selected entries: ${err.message}`, true);
  }
}

// ── fullscreen editor ─────────────────────────────────────────────
let fullCtx = null;
const FULL_TITLE = { content: "Edit Content", description: "Edit Description" };
function openFull(id, field) {
  const e = S.entries.find((x) => x.id === id);
  if (!e) return;
  const original = e[field] ?? "";
  fullCtx = { id, field, original };
  $("#full").innerHTML = `
    <div class="fhead">
      <div class="ft">
        <div class="fn">${FULL_TITLE[field]}</div>
        <div class="fs">${esc(e.name)}</div>
      </div>
      <button class="wrapb" data-act="wrap" aria-pressed="true">↵</button>
      <button class="done" data-act="full-done">Done</button>
    </div>
    <div class="fcount" id="fcount"></div>
    <div class="fbody"><textarea id="fulltext" spellcheck="false">${esc(original)}</textarea></div>
    <div class="ffoot">
      ${["# ", "## ", "**", "_", "- ", "> ", "`", "[]", "\n"].map((t) =>
        `<button class="mdb" data-act="md" data-t="${esc(t)}">${esc(t.trim() || "↵")}</button>`).join("")}
    </div>`;
  screen("full");

  const ta = $("#fulltext");
  const counts = $("#fcount");
  const startTokens = tokensOf(original);
  const budget = S.book?.tokenBudget || 0;

  const paint = () => {
    const ch = ta.value.length;
    const tk = tokensOf(ta.value);
    const dCh = ch - original.length;
    const dTk = tk - startTokens;
    const sign = (n) => (n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString());
    const cls = dTk > 0 ? "up" : dTk < 0 ? "down" : "same";
    counts.innerHTML = `
      <span><b>${ch.toLocaleString()}</b> ch</span>
      <span><b>${tk.toLocaleString()}</b> tokens (est.)</span>
      ${budget ? `<span class="pc">${((tk / budget) * 100).toFixed(1)}% of budget</span>` : ""}
      ${dTk || dCh ? `<span class="delta ${cls}">${sign(dCh)} ch · ${sign(dTk)} tokens</span>` : ""}`;
  };
  paint();
  ta.addEventListener("input", paint);
  ta.focus();
}

async function closeFull() {
  if (!fullCtx) return screen("list");
  const value = $("#fulltext").value;
  const { id, field } = fullCtx;
  fullCtx = null;
  screen("list");
  await save(id, { [field]: value }, { immediate: true });
  renderRows();
}

// ── events ────────────────────────────────────────────────────────
document.addEventListener("click", async (ev) => {
  const t = ev.target.closest("[data-act]");
  if (!t) return;
  const { act, id } = t.dataset;

  switch (act) {
    case "open-book": return openBook(id);
    case "to-picker": screen("pick"); return;
    case "to-list": screen("list"); return;
    case "open-tags": renderTags(); screen("tags"); return;

    case "mode": {
      S.mode = t.dataset.mode;
      html.setAttribute("data-mode", S.mode);
      for (const b of document.querySelectorAll("[data-act='mode']")) {
        b.setAttribute("aria-pressed", String(b.dataset.mode === S.mode));
      }
      $("#probe").placeholder = S.mode === "test"
        ? "Paste a paragraph or sample messages here…"
        : "Search entries…";
      return render();
    }
    case "sort": S.sort = t.dataset.key; S.group = false; return render();
    case "group": S.group = !S.group; return render();
    case "flagged": S.flaggedOnly = !S.flaggedOnly; return render();

    case "toggle": {
      if (S.selecting) {
        S.selected.has(id) ? S.selected.delete(id) : S.selected.add(id);
        return render();
      }
      S.open.has(id) ? S.open.delete(id) : S.open.add(id);
      return renderRows();
    }
    case "sub": {
      const key = `${id}:${t.dataset.sub}`;
      if (S.sub.has(key)) S.sub.delete(key);
      else {
        // one section at a time per entry, matching the engine's inline editor
        for (const s of SUBS) S.sub.delete(`${id}:${s}`);
        S.sub.add(key);
      }
      return renderRows();
    }

    case "select-mode":
      S.selecting = !S.selecting;
      if (!S.selecting) S.selected.clear();
      return render();
    case "sel-clear": S.selecting = false; S.selected.clear(); return render();
    case "sel-enable": return bulk({ enabled: true });
    case "sel-disable": return bulk({ enabled: false });
    case "sel-tag": {
      const tag = prompt("Add tag… (blank to clear)");
      if (tag === null) return;
      return bulk({ tag: tag.trim() });
    }
    case "sel-tag-all": {
      S.selecting = true;
      for (const e of S.entries) if ((e._tag || UNTAGGED) === t.dataset.tag) S.selected.add(e.id);
      return render();
    }
    case "tag-filter": {
      S.mode = "find"; html.setAttribute("data-mode", "find");
      S.query = t.dataset.tag === UNTAGGED ? "" : t.dataset.tag;
      $("#probe").value = S.query;
      S.group = true;
      screen("list");
      return render();
    }
    case "tag-select": {
      S.selecting = true; S.selected.clear();
      for (const e of S.entries) if ((e._tag || UNTAGGED) === t.dataset.tag) S.selected.add(e.id);
      screen("list");
      return render();
    }

    case "status": {
      const v = t.dataset.v;
      const patch = v === "disabled" ? { enabled: false }
        : v === "constant" ? { enabled: true, constant: true, selective: false }
        : v === "selective" ? { enabled: true, constant: false, selective: true }
        : { enabled: true, constant: false, selective: false };
      await save(id, patch, { immediate: true });
      return renderRows();
    }
    case "pos": {
      await save(id, { position: Number(t.dataset.v) }, { immediate: true });
      return renderRows();
    }
    case "order": {
      const e = S.entries.find((x) => x.id === id);
      await save(id, { order: Math.max(0, e.order + Number(t.dataset.d)) }, { immediate: true });
      return renderRows();
    }
    case "key-add": {
      const k = prompt("Add key");
      if (!k?.trim()) return;
      const e = S.entries.find((x) => x.id === id);
      await save(id, { keys: [...e.keys, k.trim()] }, { immediate: true });
      return renderRows();
    }
    case "key-del": {
      const e = S.entries.find((x) => x.id === id);
      await save(id, { keys: e.keys.filter((_, i) => i !== Number(t.dataset.i)) }, { immediate: true });
      return renderRows();
    }
    case "delete": {
      if (!confirm("Delete this lorebook entry?")) return;
      try {
        await api(`/lorebooks/${S.book.id}/entries/${id}`, { method: "DELETE" });
        S.entries = S.entries.filter((x) => x.id !== id);
        S.open.delete(id);
        recomputeThresholds();
        toast("Deleted 1 entry.");
        return render();
      } catch (err) { return toast(`Failed to delete entry: ${err.message}`, true); }
    }
    case "new-entry": {
      const name = prompt("Add Entry", "New Entry");
      if (!name?.trim()) return;
      try {
        const created = await api(`/lorebooks/${S.book.id}/entries`, {
          method: "POST", body: JSON.stringify({ name: name.trim(), content: "", keys: [] }),
        });
        S.entries.push(decorate(created));
        S.open.add(created.id);
        S.sub.add(`${created.id}:content`);
        recomputeThresholds();
        return render();
      } catch (err) { return toast(`Failed to add entry: ${err.message}`, true); }
    }

    case "expand": return openFull(id, t.dataset.field);
    case "full-done": return closeFull();
    case "wrap": {
      const on = t.getAttribute("aria-pressed") === "true";
      t.setAttribute("aria-pressed", String(!on));
      $("#fulltext").classList.toggle("nowrap", on);
      return;
    }
    case "md": {
      const ta = $("#fulltext");
      const tok = t.dataset.t;
      const { selectionStart: a, selectionEnd: b, value } = ta;
      ta.value = value.slice(0, a) + tok + value.slice(b);
      ta.selectionStart = ta.selectionEnd = a + tok.length;
      ta.focus();
      return;
    }
    case "retry": return boot();
  }
});

document.addEventListener("input", (ev) => {
  const el = ev.target;
  if (el.id === "probe") { S.query = el.value; return render(); }
  if (el.dataset?.field && el.dataset?.id) save(el.dataset.id, { [el.dataset.field]: el.value });
});

document.addEventListener("focusout", (ev) => {
  const el = ev.target;
  if (el.dataset?.field && el.dataset?.id && timers.has(el.dataset.id)) {
    clearTimeout(timers.get(el.dataset.id));
    save(el.dataset.id, { [el.dataset.field]: el.value }, { immediate: true });
  }
});

await boot();
hydratePickerStats();
