import { useEffect, useState } from "preact/hooks";
import { navigate } from "../../shell/router";
import { fetchBooks, fetchEntries, entryTokens, type Lorebook } from "./data";

interface BookStats { n: number; constant: number; sum: number; }

export function Picker() {
  const [books, setBooks] = useState<Lorebook[] | null>(null);
  const [stats, setStats] = useState<Record<string, BookStats>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBooks()
      .then((list) => {
        setBooks(list);
        for (const b of list) {
          fetchEntries(b.id).then((entries) => {
            setStats((s) => ({
              ...s,
              [b.id]: {
                n: entries.length,
                constant: entries.filter((e) => e.constant && e.enabled).length,
                sum: entries.reduce((a, e) => a + entryTokens(e), 0),
              },
            }));
          }).catch(() => {});
        }
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return <div class="screen"><div class="empty"><p class="t-label">Cannot reach engine</p><p class="t-data">{error}</p></div></div>;
  }
  if (!books) return <div class="screen"><div class="empty">Loading lorebooks…</div></div>;

  return (
    <div class="screen">
      <div class="screen-head">
        <h1 class="screen-title">Lorebooks</h1>
        <span class="meta"><span>{books.length} books</span></span>
      </div>
      {books.map((b) => {
        const s = stats[b.id];
        const over = s ? s.sum > b.tokenBudget : false;
        const pct = s ? Math.min(100, (s.sum / b.tokenBudget) * 100) : 0;
        return (
          <button key={b.id} class="card" onClick={() => navigate(`lorebooks/${b.id}`)}>
            <div class="card-title">{b.name}</div>
            <div class="meta">
              <span><b class="t-num">{s?.n ?? "—"}</b> {s?.n === 1 ? "entry" : "entries"}</span>
              <span><b class="t-num">{s?.constant ?? 0}</b> constant</span>
              <span>
                <b class="t-num" style={over ? "color: var(--flag)" : undefined}>{(s?.sum ?? 0).toLocaleString()}</b>
                {" "}/ {b.tokenBudget.toLocaleString()} tokens (est.)
              </span>
              {!b.enabled && <span style="color: var(--danger)">disabled</span>}
            </div>
            <div class="bar"><i class={over ? "is-over" : ""} style={`width:${pct}%`} /></div>
          </button>
        );
      })}
    </div>
  );
}
