import { DetailSection } from "marinara-console";

const body = { whiteSpace: "pre-wrap" as const, margin: 0, fontSize: 13.5, color: "var(--text)" };

function Count(props: { used: number; cap: number }) {
  return (
    <span className="t-data" style={{ marginLeft: "auto", fontSize: 11, color: "var(--text)" }}>
      {props.used.toLocaleString()}
      <i style={{ fontStyle: "normal", color: "var(--text-dim)", fontSize: 10 }}> / {props.cap.toLocaleString()}</i>
    </span>
  );
}

function Bar(props: { pct: number; hue: string }) {
  return (
    <span style={{ display: "block", height: 4, marginTop: 5, borderRadius: 2, background: "var(--surface-2)" }}>
      <i style={{ display: "block", height: "100%", width: `${props.pct}%`, borderRadius: 2, background: props.hue }} />
    </span>
  );
}

export function Plain() {
  return (
    <div style={{ maxWidth: 460 }}>
      <DetailSection sectionKey="core">
        <p className="t-prose" style={body}>
          {
            "- Devi Okonkwo keeps every promise made to a client, however small, and resents being thanked for it.\n- Runs the salvage desk at Harbour Ledger on a fortnight rota she has never once traded away."
          }
        </p>
      </DetailSection>
    </div>
  );
}

export function Metered() {
  return (
    <div style={{ maxWidth: 460 }}>
      <DetailSection
        sectionKey="voice"
        meta={<Count used={862} cap={1000} />}
        meter={<Bar pct={86} hue="var(--flag)" />}
      >
        <p className="t-prose" style={body}>
          {
            '- Speaks in short declaratives; the longer the sentence, the less she means it.\n- Says "noted" when she disagrees and intends to do nothing about it.\n- Never uses a client\'s first name until the writ is signed.'
          }
        </p>
      </DetailSection>
    </div>
  );
}

export function Stacked() {
  return (
    <div style={{ maxWidth: 460 }}>
      <DetailSection
        sectionKey="backstory"
        meta={<Count used={418} cap={1000} />}
        meter={<Bar pct={42} hue="var(--accent)" />}
      >
        <p className="t-prose" style={body}>
          {"- Left the Meridian archive after the flood took the lower stacks she was hired to catalogue."}
        </p>
      </DetailSection>
      <DetailSection
        sectionKey="habits"
        meta={<Count used={207} cap={1000} />}
        meter={<Bar pct={21} hue="var(--accent)" />}
      >
        <p className="t-prose" style={body}>
          {"- Reads the last page of a ledger first.\n- Keeps a second, unofficial tally in pencil."}
        </p>
      </DetailSection>
    </div>
  );
}
