import "./MiddleTruncate.css";

/** How many trailing characters the head gives up before the tail gives up any. */
const TAIL = 24;
/** How far back the split may travel to land on a word start. */
const SNAP = 12;

/** `[head, tail]` — the last `tail` characters, pulled back to the start of
 *  whatever word that lands inside, with everything before them as the head.
 *  Counted in graphemes, so a split never lands inside an emoji or a letter and
 *  its combining marks. A title no longer than the tail has no middle to give up
 *  and keeps all of it in the head, where it end-truncates like any list title. */
export function splitTitle(text: string, tail = TAIL): [string, string] {
  const units = [...new Intl.Segmenter().segment(text)].map((s) => s.segment);
  if (units.length <= tail) return [text, ""];
  let cut = units.length - tail;
  for (let i = cut; i > cut - SNAP && i > 0; i--)
    if (units[i - 1] === " ") {
      cut = i;
      break;
    }
  return [units.slice(0, cut).join(""), units.slice(cut).join("")];
}

/** A one-line title that gives up its MIDDLE rather than its end.
 *
 *  Titles here share long prefixes — every lorebook entry from one book begins
 *  `Lorebook - Ashgate — Harbour Canon:` — so end-truncation deletes the only
 *  part that tells them apart. The head takes the ellipsis first; once the head
 *  is gone the tail sheds from its own start, so the last characters survive at
 *  any width. Nothing is measured: the shrink is the flex algorithm's, which is
 *  why a wide script costs width rather than breaking the split.
 *
 *  Splitting the string across two boxes is what costs the title its text: a
 *  selection spanning two block boxes copies them on separate lines, and a box
 *  squeezed to nothing drops out of the selection altogether. So the unbroken
 *  string is carried by a third, clipped span — the only one a selection or a
 *  screen reader can reach — and the two visible ones are inert.
 *
 *  `className` is for a host that owns the title's BOX — how it sits in its
 *  flex line, what color and face it takes. */
export function MiddleTruncate(props: { text: string; tail?: number; className?: string }) {
  const cls = `mtrunc${props.className ? ` ${props.className}` : ""}`;
  const [head, tail] = splitTitle(props.text, props.tail);
  return (
    <span className={cls} title={props.text}>
      <span className="mtrunc-whole">{props.text}</span>
      <span className="mtrunc-head" aria-hidden>
        {head}
      </span>
      {/* bdi: the tail's box is laid out right-to-left so its ellipsis lands at
          the start, and the isolate keeps the text itself in its own reading
          order inside that box. */}
      {tail && (
        <span className="mtrunc-tail" aria-hidden>
          <bdi>{tail}</bdi>
        </span>
      )}
    </span>
  );
}
