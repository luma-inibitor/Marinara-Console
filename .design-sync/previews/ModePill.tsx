import { ModePill } from "marinara-console";

const col = { display: "grid", gap: "var(--s2)", justifyItems: "start" as const };

/** The read-out form: no `onToggle`, so it is a state display. Every segment
 *  always renders, so a column of pills stays skimmable. */
export function Readout() {
  return (
    <div style={col}>
      <ModePill modes={["conversation", "roleplay", "game"]} />
      <ModePill modes={["roleplay"]} />
      <ModePill modes={["conversation", "game"]} />
    </div>
  );
}

/** Nothing lit is a legitimate state and still renders all three segments. */
export function Unset() {
  return (
    <div style={col}>
      <ModePill modes={[]} />
    </div>
  );
}

/** Pass `onToggle` and each segment becomes an independent toggle. Only this
 *  form takes the accent border, because accent is reserved for interactive. */
export function Interactive() {
  return (
    <div style={col}>
      <ModePill modes={new Set(["roleplay", "game"])} onToggle={() => {}} label="Filter by mode" />
      <ModePill modes={new Set(["conversation", "roleplay", "game"])} onToggle={() => {}} label="Filter by mode" />
    </div>
  );
}

/** In situ: the pill beside the row it describes. */
export function InARow() {
  return (
    <div style={{ display: "grid", gap: "var(--s1)", width: 380 }}>
      {[["Devi at the salvage desk", ["roleplay"]], ["Ledger audit, fortnight 6", ["conversation", "game"]]].map(([name, modes]) => (
        <div key={name as string} style={{ display: "flex", alignItems: "center", gap: "var(--s2)",
                                           minHeight: "var(--tap)", borderBottom: "var(--hairline)" }}>
          <span className="t-prose" style={{ flex: 1, fontSize: 13.5 }}>{name as string}</span>
          <ModePill modes={modes as string[]} />
        </div>
      ))}
    </div>
  );
}
