import { cn } from "./cn";

/** How many trailing characters the tail keeps. */
const TAIL = 24;
/** How far back the split may travel to land on a word start. */
const SNAP = 12;

/** `[head, tail]`, split in graphemes so a cut never lands inside one. */
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

/** A one-line title that elides its middle, so the tail survives at any width. */
export function MiddleTruncate(props: { text: string; tail?: number; className?: string }) {
  const [head, tail] = splitTitle(props.text, props.tail);
  return (
    <span className={cn("relative flex min-w-0 items-baseline", props.className)} title={props.text}>
      <span className="absolute size-px min-w-0 truncate [clip-path:inset(50%)]">{props.text}</span>
      <span className="max-w-max min-w-0 shrink grow basis-0 truncate select-none" aria-hidden>
        {head}
      </span>
      {tail && (
        <span className="min-w-0 flex-initial truncate select-none [direction:rtl]" aria-hidden>
          <bdi>{tail}</bdi>
        </span>
      )}
    </span>
  );
}
