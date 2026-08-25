import { IconButton, Back, Tags, More, Refresh, Download, Preview, Raw, Edit, ICON_SIZE } from "marinara-console";

const bar = { display: "flex", gap: "var(--s2)", alignItems: "center" };

/** A tool header's control run. `label` is required on every one — an
 *  icon-only control with no accessible name is unnameable by voice control. */
export function HeaderRun() {
  return (
    <div style={bar}>
      <IconButton label="Back to lorebooks" onClick={() => {}}>
        <Back size={ICON_SIZE.xl} stroke={1.75} aria-hidden />
      </IconButton>
      <span className="t-prose" style={{ flex: 1, fontSize: 15 }}>Harbour Ledger</span>
      <IconButton label="Tag distribution" onClick={() => {}}>
        <Tags size={ICON_SIZE.xl} stroke={1.75} aria-hidden />
      </IconButton>
      <IconButton label="More actions" onClick={() => {}}>
        <More size={ICON_SIZE.xl} stroke={1.75} aria-hidden />
      </IconButton>
    </div>
  );
}

/** Pass `href` and it renders an anchor: a download that looks like a button
 *  is still a link and keeps a link's behaviours. */
export function AsLink() {
  return (
    <div style={bar}>
      <IconButton label="Download this memory as JSON" href="#" download>
        <Download size={ICON_SIZE.xl} stroke={1.75} aria-hidden />
      </IconButton>
      <IconButton label="Re-fetch" onClick={() => {}}>
        <Refresh size={ICON_SIZE.xl} stroke={1.75} aria-hidden />
      </IconButton>
    </div>
  );
}

/** One glyph per concept: rendered vs source is a pair, and disabled states
 *  stay in place rather than disappearing. */
export function States() {
  return (
    <div style={bar}>
      <IconButton label="Show the rendered view" onClick={() => {}}>
        <Preview size={ICON_SIZE.xl} stroke={1.75} aria-hidden />
      </IconButton>
      <IconButton label="Show the source record" onClick={() => {}}>
        <Raw size={ICON_SIZE.xl} stroke={1.75} aria-hidden />
      </IconButton>
      <IconButton label="Edit this section" disabled>
        <Edit size={ICON_SIZE.xl} stroke={1.75} aria-hidden />
      </IconButton>
    </div>
  );
}
