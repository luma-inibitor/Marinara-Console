import { useState } from "preact/hooks";
import {
  Preview, Raw, Copy, Copied, ChevronRight, ChevronDown,
} from "./icons";
import { toast } from "../shell/toast";
import "./JsonView.css";

type Mode = "tree" | "raw";

/** A JSON value, viewable two ways.
 *
 *  The tree view is the default: objects and arrays fold, so a long record is
 *  a shape you can navigate rather than a wall you scroll. The raw view is the
 *  literal text, for when you need to copy a fragment or see exactly what the
 *  engine sent — a pretty-printer is an interpretation, and sometimes the
 *  interpretation is the thing you are debugging.
 *
 *  The three controls sit inside the block, pinned to its top-right, so they
 *  cost no vertical space and stay put while the content scrolls under them.
 *  The first line is padded to clear them, because a control that covers the
 *  opening brace is a control sitting on the data. */
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
      toast("Could not copy — the clipboard is unavailable here", { kind: "error" });
    }
  };

  return (
    <div className="jsonview">
      <div className="jsonview-tools" role="group" aria-label={props.label ?? "JSON view"}>
        <button type="button" className="jsonview-t" aria-pressed={mode === "tree"}
          aria-label="Folding view" title="Folding view" onClick={() => setMode("tree")}>
          <Preview size={13} stroke={1.75} aria-hidden />
        </button>
        <button type="button" className="jsonview-t" aria-pressed={mode === "raw"}
          aria-label="Plain text" title="Plain text" onClick={() => setMode("raw")}>
          <Raw size={13} stroke={1.75} aria-hidden />
        </button>
        <button type="button" className="jsonview-t" aria-label={copied ? "Copied" : "Copy JSON"}
          title="Copy JSON" onClick={copy}>
          {copied
            ? <Copied size={13} stroke={2} aria-hidden />
            : <Copy size={13} stroke={1.75} aria-hidden />}
        </button>
      </div>
      {mode === "raw"
        ? <pre className="jsonview-raw t-data">{text}</pre>
        : <div className="jsonview-tree t-data"><Node value={props.value} depth={0} last /></div>}
    </div>
  );
}

/** One JSON value. Objects and arrays render a fold; everything else is a leaf.
 *  Open to depth 1 by default: the top level is the shape you came to read,
 *  and anything deeper is a decision you make. */
function Node(props: { name?: string; value: unknown; depth: number; last: boolean }) {
  const { value } = props;
  const isArray = Array.isArray(value);
  const isObject = !isArray && typeof value === "object" && value !== null;
  const [open, setOpen] = useState(props.depth < 1);

  if (!isArray && !isObject) {
    return (
      <div className="jn" style={{ paddingLeft: `${props.depth * 12}px` }}>
        {props.name !== undefined && <span className="jk">{props.name}:</span>}
        <Leaf value={value} />
        {!props.last && <span className="jc">,</span>}
      </div>
    );
  }

  const entries: Array<[string, unknown]> = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, unknown>);
  const openBrace = isArray ? "[" : "{";
  const closeBrace = isArray ? "]" : "}";
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <div className="jgroup">
      {/* The whole header line is the control, not just the chevron. An 11px
          glyph is a sniper target, and the key and the brace are the parts you
          were already looking at (owner's call, 2026-08-22). */}
      <button
        type="button"
        className="jn jn-head"
        style={{ paddingLeft: `${props.depth * 12}px` }}
        aria-expanded={open}
        aria-label={`${open ? "Collapse" : "Expand"} ${props.name ?? "root"} (${entries.length})`}
        onClick={() => setOpen(!open)}
      >
        <span className="jtoggle"><Chevron size={11} stroke={2} aria-hidden /></span>
        {props.name !== undefined && <span className="jk">{props.name}:</span>}
        <span className="jb">{openBrace}</span>
        {/* a folded node still says how much it hides, so a fold never reads
            as missing content */}
        {!open && <><span className="jn-count">{entries.length}</span><span className="jb">{closeBrace}</span>
          {!props.last && <span className="jc">,</span>}</>}
      </button>
      {open && (
        <>
          {entries.map(([k, v], i) => (
            <Node key={k} name={isArray ? undefined : k} value={v}
              depth={props.depth + 1} last={i === entries.length - 1} />
          ))}
          {/* the closing brace closes the group too — the same target, at the
              other end, for when you have scrolled past the header */}
          <button type="button" className="jn jn-head jn-close"
            style={{ paddingLeft: `${props.depth * 12}px` }}
            aria-label={`Collapse ${props.name ?? "root"} (${entries.length})`}
            onClick={() => setOpen(false)}>
            <span className="jb">{closeBrace}</span>{!props.last && <span className="jc">,</span>}
          </button>
        </>
      )}
    </div>
  );
}

/** Leaves are typed by hue as well as by shape, so a "42" and a 42 are not the
 *  same thing on screen — the difference is exactly what you open this for. */
function Leaf({ value }: { value: unknown }) {
  if (value === null) return <span className="jv jv-null">null</span>;
  switch (typeof value) {
    case "string": return <span className="jv jv-str">"{value}"</span>;
    case "number": return <span className="jv jv-num">{String(value)}</span>;
    case "boolean": return <span className="jv jv-bool">{String(value)}</span>;
    default: return <span className="jv">{String(value)}</span>;
  }
}
