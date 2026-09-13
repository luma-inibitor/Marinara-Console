import { useState } from "react";
import { Button } from "./Button";
import { cva } from "./cn";
import { Preview, Raw, CopyGlyph, ChevronRight, ChevronDown, ICON_SIZE } from "./icons";
import { toast } from "../shell/toast";
import { t } from "../copy";

type Mode = "tree" | "raw";

/** `root` clears the control cluster, which floats over the first row. */
const row = cva("flex items-baseline gap-1 wrap-anywhere whitespace-pre-wrap", {
  variants: { root: { true: "pr-[84px]" } },
});
/** A fold row keeps the tree's data face and box over the Button label face. */
const head = cva(
  [
    "group/head rounded-[3px] border-0 px-0 font-data text-data font-normal [font-variation-settings:normal]",
    "wrap-anywhere whitespace-pre-wrap hover:bg-surface-2",
  ],
  { variants: { root: { true: "pr-[84px]" } } },
);
const HEAD_ROW = "flex w-full items-center gap-1";
const KEY = "shrink-0 text-ink";
const PUNCT = "text-dim";

/** A JSON value as a folding tree or as its literal text, with a copy control. */
export function JsonView(props: { value: unknown; label?: string }) {
  const [mode, setMode] = useState<Mode>("tree");
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(props.value, null, 2);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast(t("ui.copy.failed"), { kind: "error" });
    }
  };

  return (
    <div className="relative max-h-[40vh] overflow-auto rounded-sm border border-edge bg-canvas p-2 text-data-s leading-[1.55]">
      <div
        className="sticky top-0 z-1 float-right -mt-[2px] -mr-[2px] ml-2 inline-flex gap-[2px] rounded-sm border border-edge bg-surface-2 p-[2px]"
        role="group"
        aria-label={props.label ?? t("ui.json.viewLabel")}
      >
        <Button
          iconOnly
          variant="ghost"
          size="xs"
          pressed={mode === "tree"}
          label={t("ui.json.folding")}
          icon={<Preview size={ICON_SIZE.sm} stroke={1.75} aria-hidden />}
          onClick={() => setMode("tree")}
        />
        <Button
          iconOnly
          variant="ghost"
          size="xs"
          pressed={mode === "raw"}
          label={t("ui.json.plain")}
          icon={<Raw size={ICON_SIZE.sm} stroke={1.75} aria-hidden />}
          onClick={() => setMode("raw")}
        />
        <Button
          iconOnly
          variant="ghost"
          size="xs"
          label={t("ui.copy.json")}
          icon={<CopyGlyph done={copied} />}
          onClick={copy}
        />
      </div>
      <span role="status" className="sr-only">
        {copied ? t("ui.copy.copied") : ""}
      </span>
      {mode === "raw" ? (
        <pre className="t-data whitespace-pre text-dim">{text}</pre>
      ) : (
        <div className="t-data text-dim">
          <Node value={props.value} depth={0} last />
        </div>
      )}
    </div>
  );
}

/** One JSON value, open to depth 1 by default. */
function Node(props: { name?: string; value: unknown; depth: number; last: boolean }) {
  const { value } = props;
  const isArray = Array.isArray(value);
  const isObject = !isArray && typeof value === "object" && value !== null;
  const [open, setOpen] = useState(props.depth < 1);
  const indent = { paddingLeft: `${props.depth * 12}px` };
  const root = props.depth === 0;

  if (!isArray && !isObject) {
    return (
      <div className={row({ root })} style={indent}>
        {props.name !== undefined && <span className={KEY}>{props.name}:</span>}
        <Leaf value={value} />
        {!props.last && <span className={PUNCT}>,</span>}
      </div>
    );
  }

  const entries: Array<[string, unknown]> = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, unknown>);
  const openBrace = isArray ? "[" : "{";
  const closeBrace = isArray ? "]" : "}";
  const Chevron = open ? ChevronDown : ChevronRight;
  const label = props.name ?? t("ui.json.root");

  return (
    <div>
      <Button
        variant="ghost"
        size="xs"
        labelCase="sentence"
        align="start"
        fullWidth
        className={head({ root })}
        style={indent}
        expanded={open}
        label={t(open ? "ui.group.collapse" : "ui.group.expand", { label, count: entries.length })}
        onClick={() => setOpen(!open)}
      >
        <span className={HEAD_ROW}>
          <span className="-ml-3 inline-flex h-[14px] w-3 shrink-0 items-center text-faint group-hover/head:text-ink">
            <Chevron size={11} stroke={2} aria-hidden />
          </span>
          {props.name !== undefined && <span className={KEY}>{props.name}:</span>}
          <span className={PUNCT}>{openBrace}</span>
          {!open && (
            <>
              <span className="mx-1 rounded-full bg-surface-2 px-[5px] text-label-s text-dim">{entries.length}</span>
              <span className={PUNCT}>{closeBrace}</span>
              {!props.last && <span className={PUNCT}>,</span>}
            </>
          )}
        </span>
      </Button>
      {open && (
        <>
          {entries.map(([k, v], i) => (
            <Node
              key={k}
              name={isArray ? undefined : k}
              value={v}
              depth={props.depth + 1}
              last={i === entries.length - 1}
            />
          ))}
          <Button
            variant="ghost"
            size="xs"
            labelCase="sentence"
            align="start"
            fullWidth
            className={head()}
            style={indent}
            label={t("ui.group.collapse", { label, count: entries.length })}
            onClick={() => setOpen(false)}
          >
            <span className={HEAD_ROW}>
              <span className={PUNCT}>{closeBrace}</span>
              {!props.last && <span className={PUNCT}>,</span>}
            </span>
          </Button>
        </>
      )}
    </div>
  );
}

/** Leaves are typed by hue as well as by shape. */
function Leaf({ value }: { value: unknown }) {
  if (value === null) return <span className="min-w-0 wrap-anywhere text-dim italic">{String(value)}</span>;
  switch (typeof value) {
    case "string":
      return <span className="min-w-0 wrap-anywhere text-ok">"{value}"</span>;
    case "number":
      return <span className="min-w-0 wrap-anywhere text-accent">{String(value)}</span>;
    case "boolean":
      return <span className="min-w-0 wrap-anywhere text-warn">{String(value)}</span>;
    default:
      return <span className="min-w-0 wrap-anywhere">{String(value)}</span>;
  }
}
