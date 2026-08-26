import { Loading, ErrorState, ListEmpty } from "../../ui";
import { useEffect, useState } from "react";
import { t } from "../../copy";
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
  const [error, setError] = useState<unknown>(null);

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
    let alive = true;
    fetchBooks()
      .then((list) => { if (!alive) return; setBooks(list); for (const b of list) loadStats(b.id); })
      .catch((e: unknown) => { if (alive) setError(e); });
    return () => { alive = false; };
  }, []);

  const retry = () => { setError(null); setBooks(null); loadAll(setBooks, setError, loadStats); };

  if (error) return <div className="screen"><ErrorState error={error} onRetry={retry} /></div>;
  if (!books) return <div className="screen"><Loading what="lorebooks.title" onRetry={retry} /></div>;

  return (
    <div className="screen">
      <div className="screen-head">
        <h1 className="screen-title">{t("lorebooks.title")}</h1>
        <span className="meta"><span>{t("lorebooks.bookCount", { count: books.length })}</span></span>
      </div>
      {books.length === 0 && <ListEmpty kind="first-run" what="lorebooks.title" />}
      {books.map((b) => {
        const s = stats[b.id];
        const ok = s?.state === "ok" ? s : null;
        const failed = s?.state === "failed" ? s : null;
        const over = ok ? ok.sum > b.tokenBudget : false;
        const pct = ok ? Math.min(100, (ok.sum / b.tokenBudget) * 100) : 0;
        return (
          <button key={b.id} className="card" onClick={() => navigate(`lorebooks/${b.id}`)}>
            <div className="card-title">{b.name}</div>
            {failed ? (
              // Say the number is missing, and let the user get it back without
              // reloading the whole screen. Never invent a value.
              <div className="meta">
                <span className="is-flag" title={failed.message}>{t("lorebooks.picker.statsUnavailable")}</span>
                <span
                  role="button"
                  tabIndex={0}
                  className="linkish"
                  onClick={(ev) => { ev.stopPropagation(); loadStats(b.id); }}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.stopPropagation(); loadStats(b.id); }
                  }}
                >{t("lorebooks.retry")}</span>
                {!b.enabled && <span style={{ color: "var(--danger)" }}>{t("lorebooks.picker.bookDisabled")}</span>}
              </div>
            ) : (
              <div className="meta">
                <span className="t-num">{t("lorebooks.entryCount", { count: ok ? ok.n : "—" })}</span>
                <span className="t-num">{t("lorebooks.tag.constantCount", { count: ok ? ok.constant : "—" })}</span>
                <span>
                  <b className="t-num" style={over ? { color: "var(--flag)" } : undefined}>
                    {ok ? ok.sum.toLocaleString() : "—"}
                  </b>
                  {" / "}{b.tokenBudget.toLocaleString()} {t("ui.editor.tokensEst")}
                </span>
                {!b.enabled && <span style={{ color: "var(--danger)" }}>{t("lorebooks.picker.bookDisabled")}</span>}
              </div>
            )}
            {/* no bar until there is a real number to draw — a 0% bar is a claim */}
            {ok && <div className="bar"><i className={over ? "is-over" : ""} style={{ width: `${pct}%` }} /></div>}
          </button>
        );
      })}
    </div>
  );
}

function loadAll(
  setBooks: (b: Lorebook[] | null) => void,
  setError: (e: unknown) => void,
  loadStats: (id: string) => void,
) {
  fetchBooks()
    .then((list) => { setBooks(list); for (const b of list) loadStats(b.id); })
    .catch((e: unknown) => setError(e));
}
