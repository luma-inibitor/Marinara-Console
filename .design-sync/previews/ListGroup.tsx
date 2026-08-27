import { useState } from "react";
import { ListGroup } from "marinara-console";

// The header row's shape belongs to the caller — ListGroup owns only the
// chevron and the fold. The real screens use `.mem-ghead` from the memory
// tool's own stylesheet, which is not in this bundle's graph, so the specimen
// carries an equivalent built from tokens.
const HEAD_CSS = `
.spec-ghead {
  display: flex; align-items: center; gap: var(--s2);
  padding: var(--s1) var(--s2);
  background: var(--surface-2);
  border: var(--hairline);
  border-radius: var(--r-s);
}
.spec-ghead .gexp { width: 24px; height: 24px; }
.spec-gn { flex: 1; }
.spec-rows { list-style: none; margin: var(--s1) 0 0; padding: 0 0 0 28px; }
.spec-rows li { padding: var(--s1) 0; border-bottom: var(--hairline); }
.spec-rows li:last-child { border-bottom: none; }
`;

function Head(props: { title: string; count: number }) {
  return (
    <>
      <span className="spec-gn t-prose">{props.title}</span>
      <span className="t-data" style={{ color: "var(--text-dim)" }}>
        {props.count}
      </span>
    </>
  );
}

function Rows(props: { items: string[] }) {
  return (
    <ul className="spec-rows">
      {props.items.map((line) => (
        <li key={line} className="t-prose">
          {line}
        </li>
      ))}
    </ul>
  );
}

const DEVI = [
  "Devi holds the harbour master's writ and may board any vessel at the wall.",
  "Devi reads the tide ledger aloud each dawn, and will not delegate it.",
  "Devi's left hand was burned in the Kessen fire and she keeps it gloved.",
];

const THREADS = [
  "Who forged the second seal on the Kessen manifest is still open.",
  "The wall's night crew has not reported for three tides.",
];

const TIMELINE = [
  "Kessen fire — the customs house burns; two ledgers survive.",
  "The writ passes to Devi, eleven days after the fire.",
  "First manifest signed under the new seal.",
];

export function Open() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div style={{ maxWidth: 460 }}>
      <style>{HEAD_CSS}</style>
      <ListGroup
        className="spec-ghead"
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        label="Devi"
        count={DEVI.length}
        head={<Head title="character · Devi" count={DEVI.length} />}
      >
        <Rows items={DEVI} />
      </ListGroup>
    </div>
  );
}

export function Collapsed() {
  const [collapsed, setCollapsed] = useState(true);
  return (
    <div style={{ maxWidth: 460 }}>
      <style>{HEAD_CSS}</style>
      <ListGroup
        className="spec-ghead"
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        label="Devi"
        count={DEVI.length}
        head={<Head title="character · Devi" count={DEVI.length} />}
      >
        <Rows items={DEVI} />
      </ListGroup>
    </div>
  );
}

export function Stack() {
  const [open, setOpen] = useState<Record<string, boolean>>({
    thread: true,
    timeline: false,
    world: false,
  });
  const toggle = (id: string) => setOpen({ ...open, [id]: !open[id] });
  const groups: Array<{ id: string; title: string; label: string; items: string[] }> = [
    { id: "thread", title: "thread · open questions", label: "Open questions", items: THREADS },
    { id: "timeline", title: "timeline_event · the Kessen fire", label: "The Kessen fire", items: TIMELINE },
    {
      id: "world",
      title: "world · the sea wall",
      label: "The sea wall",
      items: ["The sea wall closes at the third bell and opens on the tide, not the clock."],
    },
  ];
  return (
    <div style={{ maxWidth: 460, display: "grid", gap: "var(--s2)" }}>
      <style>{HEAD_CSS}</style>
      {groups.map((g) => (
        <ListGroup
          key={g.id}
          className="spec-ghead"
          collapsed={!open[g.id]}
          onToggle={() => toggle(g.id)}
          label={g.label}
          count={g.items.length}
          head={<Head title={g.title} count={g.items.length} />}
        >
          <Rows items={g.items} />
        </ListGroup>
      ))}
    </div>
  );
}
