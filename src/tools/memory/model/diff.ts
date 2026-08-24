// Line diff for the detail pane's preview zone. Update is
// the one destructive op, so its preview shows what dies: an LCS line diff,
// with word-level emphasis when a changed line keeps enough common context.
// Sections are capped at 20k chars, so the quadratic DP is comfortably small.

export interface DiffOp { t: "ctx" | "del" | "add"; text: string }

export function lineDiff(a: string[], b: string[]): DiffOp[] {
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffOp[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ t: "ctx", text: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ t: "del", text: a[i] }); i++; }
    else { out.push({ t: "add", text: b[j] }); j++; }
  }
  while (i < n) out.push({ t: "del", text: a[i++] });
  while (j < m) out.push({ t: "add", text: b[j++] });
  return out;
}

/** Common word prefix/suffix of a del/add pair. Null when the lines share too
 *  little for word emphasis to help — the caller falls back to plain lines. */
export function wordEmphasis(del: string, add: string): { pre: string; delMid: string; addMid: string; post: string } | null {
  const aw = del.split(/(\s+)/), bw = add.split(/(\s+)/);
  let p = 0;
  while (p < aw.length && p < bw.length && aw[p] === bw[p]) p++;
  let s = 0;
  while (s < aw.length - p && s < bw.length - p && aw[aw.length - 1 - s] === bw[bw.length - 1 - s]) s++;
  const pre = aw.slice(0, p).join("");
  const post = s ? aw.slice(aw.length - s).join("") : "";
  const delMid = aw.slice(p, aw.length - s).join("");
  const addMid = bw.slice(p, bw.length - s).join("");
  if (pre.length + post.length < Math.min(del.length, add.length) * 0.3) return null;
  return { pre, delMid, addMid, post };
}

export const splitLines = (text: string | undefined | null): string[] =>
  (text ?? "").split("\n").map((l) => l.trimEnd()).filter((l) => l.trim() !== "");
