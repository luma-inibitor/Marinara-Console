import { ErrorState } from "marinara-console";

/** The bare thrown-Error path: no status to derive a heading from, so the
 *  component supplies "Something failed" and the cause is the message. */
export function Thrown() {
  return (
    <div style={{ maxWidth: 460 }}>
      <ErrorState
        error={new Error("Unexpected end of JSON input")}
        onRetry={() => {}}
      />
    </div>
  );
}

/** What a tool passes when it has already reduced the failure to a sentence —
 *  the shape Vault and Review use, heading named by the caller. */
export function Reduced() {
  return (
    <div style={{ maxWidth: 460 }}>
      <ErrorState
        title="Memories could not load"
        message="The engine closed the connection before sending a response."
        onRetry={() => {}}
      />
    </div>
  );
}

/** Recovery is the call site's to name, so a second way out sits beside retry.
 *  Shaped after the preset editor, which owns both the retry and the list to
 *  fall back to. */
export function WithActions() {
  return (
    <div style={{ maxWidth: 460 }}>
      <ErrorState
        title="Could not load sections"
        message="The engine returned a section with no key."
        onRetry={() => {}}
        actions={<button className="dbtn">Back to presets</button>}
      />
    </div>
  );
}
