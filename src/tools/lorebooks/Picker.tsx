import { useEffect, useState } from "preact/hooks";
import { navigate } from "../../shell/router";
import { fetchBooks, fetchEntries, entryTokens, type Lorebook } from "./data";

// A book's stats are fetched per-book and can fail independently of the list.
// A failed fetch must NOT render as zeros: "0 / 1,000 tokens" is indistinguishable
// from an empty book, so a book 43% over budget reads as comfortably under it.
// Loading, failed, and genuinely-empty are three different things here.
type BookStats =
  | { state: "ok"; n: number; constant: number; sum: number }
  | { state: "failed"; message: string };

export function Picker() {
  const [books, setBooks] = useState<Lorebook[] | null>(null);
  const [stats, setStats] = useState<Record<string, BookStats>>({});
  const [error, setError] = useState<string | null>(null);

  const loadStats = (id: string) => {
    setStats((s) => { const n = { ...s }; delete n[id]; return n; });   // back to loading
    fetchEntries(id)
      .then((entries) => setStats((s) => ({
        ...s,
        [id]: {
          state: "ok",
          n: entries.length,
          constant: entries.filter((e) => e.constant && e.enabled).length,
          sum: entries.reduce((a, e) => a + entryTokens(e), 0),
        },
      })))
      .catch((e: Error) => setStats((s) => ({ ...s, [id]: { state: "failed", message: e.message } })));
  };

  useEffect(() => {
    fetchBooks()
      .then((list) => { setBooks(list); for (const b of list) loadStats(b.id); })
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div class="screen"><div class="empty">
        <p class="t-label">Cannot reach engine</p>
        <p>{error}</p>
        <button class="dbtn" onClick={() => { setError(null); setBooks(null); loadAll(setBooks, setError, loadStats); }}>Retry</button>
      </div></div>
    );
  }
  if (!books) return <div class="screen"><div class="empty">Loading lorebooks…</div></div>;

  return (
    <div class="screen">
      <div class="screen-head">
        <h1 class="screen-title">Lorebooks</h1>
        <span class="meta"><span>{books.length} {books.length === 1 ? "book" : "books"}</span></span>
      </div>
      {books.map((b) => {
        const s = stats[b.id];
        const ok = s?.state === "ok" ? s : null;
        const failed = s?.state === "failed" ? s : null;
        const over = ok ? ok.sum > b.tokenBudget : false;
        const pct = ok ? Math.min(100, (ok.sum / b.tokenBudget) * 100) : 0;
        return (
          <button key={b.id} class="card" onClick={() => navigate(`lorebooks/${b.id}`)}>
            <div class="card-title">{b.name}</div>
            {failed ? (
              // Say the number is missing, and let the user get it back without
              // reloading the whole screen. Never invent a value.
              <div class="meta">
                <span class="is-flag" title={failed.message}>Stats unavailable</span>
                <span
                  role="button"
                  tabIndex={0}
                  class="linkish"
                  onClick={(ev) => { ev.stopPropagation(); loadStats(b.id); }}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.stopPropagation(); loadStats(b.id); }
                  }}
                >Retry</span>
                {!b.enabled && <span style="color: var(--danger)">disabled</span>}
              </div>
            ) : (
              <div class="meta">
                <span><b class="t-num">{ok ? ok.n : "—"}</b> {ok?.n === 1 ? "entry" : "entries"}</span>
                <span><b class="t-num">{ok ? ok.constant : "—"}</b> constant</span>
                <span>
                  <b class="t-num" style={over ? "color: var(--flag)" : undefined}>
                    {ok ? ok.sum.toLocaleString() : "—"}
                  </b>
                  {" "}/ {b.tokenBudget.toLocaleString()} tokens (est.)
                </span>
                {!b.enabled && <span style="color: var(--danger)">disabled</span>}
              </div>
            )}
            {/* no bar until there is a real number to draw — a 0% bar is a claim */}
            {ok && <div class="bar"><i class={over ? "is-over" : ""} style={`width:${pct}%`} /></div>}
          </button>
        );
      })}
    </div>
  );
}

function loadAll(
  setBooks: (b: Lorebook[] | null) => void,
  setError: (e: string | null) => void,
  loadStats: (id: string) => void,
) {
  fetchBooks()
    .then((list) => { setBooks(list); for (const b of list) loadStats(b.id); })
    .catch((e: Error) => setError(e.message));
}
