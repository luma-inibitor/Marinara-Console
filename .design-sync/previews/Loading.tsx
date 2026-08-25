import { Loading } from "marinara-console";

/** `what` names the subject and the component writes the sentence. */
export function Named() {
  return (
    <div style={{ maxWidth: 460 }}>
      <Loading what="lorebooks" onRetry={() => {}} />
    </div>
  );
}

/** `label` is for a caller that already holds a fully formed sentence. */
export function Labelled() {
  return (
    <div style={{ maxWidth: 460 }}>
      <Loading label="Loading pending review drafts…" />
    </div>
  );
}

/** No subject named at all — the component falls back to "this view". */
export function Unnamed() {
  return (
    <div style={{ maxWidth: 460 }}>
      <Loading />
    </div>
  );
}
