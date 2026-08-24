// The memory detail card — a read-only screen for one stored memory.
//
// Two jobs, in this order: let a reader read what the memory says, and let
// them predict whether it will fire in a chat. Everything on the screen serves
// one of those, which is why there is no decide bar, no archive, and no
// editing beyond the one control that leaves for the editor.
//
// The screen's load-bearing rule is that the RETRIEVAL BLOCK is the only
// bordered surface: boxed means metadata, unboxed means content. A second card
// anywhere — especially around a section body — collapses that distinction and
// was the single biggest failure of the directions that lost.
//
// All state here is view-local. Nothing is persisted and nothing is fetched:
// the note arrives as a prop.

import { useState } from "react";
import type { Note } from "../data";
import { t } from "../../../copy";
import { TypeIcon } from "../icons";
import { Back, Edit, ExpandSet, ICON_SIZE } from "../../../ui/icons";
import { Chip, CopyableText, IconButton } from "../../../ui";
import { RetrievalCard } from "./RetrievalCard";
import { SectionRow } from "./SectionRow";
import { SectionPeek } from "./SectionPeek";
import { editStamp, sectionViews } from "./model";
import "./MemoryDetail.css";

/** Past this many sections the card opens collapsed. Collapse-all is the
 *  manifest state — every section becomes a bare row — so a long memory needs
 *  no separate overflow design, only a different starting point. */
const COLLAPSE_PAST = 6;

export function MemoryDetail(props: {
  note: Note;
  onBack: () => void;
  /** Omitted where the screen has nowhere to send an editor. */
  onEdit?: () => void;
  defaultCollapsed?: boolean;
}) {
  const n = props.note;
  const views = sectionViews(n);

  // The collapse-all baseline, and the per-section overrides laid over it.
  // Effective open = override ?? baseline, so toggling the baseline has to
  // clear the overrides or a row would keep answering to a stale decision.
  const [allOpen, setAllOpen] = useState(!(props.defaultCollapsed ?? views.length > COLLAPSE_PAST));
  const [openBySection, setOpenBySection] = useState<Record<string, boolean>>({});
  const [peekKey, setPeekKey] = useState<string | null>(null);
  const [flagKey, setFlagKey] = useState<string | null>(null);

  const isOpen = (key: string) => openBySection[key] ?? allOpen;
  const toggleAll = () => {
    setAllOpen((was) => !was);
    setOpenBySection({});
  };

  const chars = views.reduce((sum, v) => sum + v.chars, 0);
  const edited = editStamp(n.updatedAt);
  const peeked = peekKey ? views.find((v) => v.key === peekKey) ?? null : null;

  return (
    <div className="mdc">
      <header className="console mdc-head">
        <div className="hrow">
          <IconButton className="mdc-back" label={t("memory.backToVault")} onClick={props.onBack}>
            <Back size={ICON_SIZE.xl} stroke={1.75} aria-hidden />
          </IconButton>
          <TypeIcon type={n.type} size={ICON_SIZE.lg} />
          {/* Titles wrap and never truncate: the title is the last thing on
              the screen that may be cut. */}
          <h1 className="mdc-title">{n.title ?? n.id}</h1>
          <span className={`stt t-data mdc-status st-${n.status}`}>{n.status}</span>
        </div>
        <div className="mdc-meta t-data">
          <span className={`mdc-type type-${n.type}`}>{n.type.replaceAll("_", " ")}</span>
          {edited && <><i className="mdc-sep" data-contrast-exempt>·</i><span>{t("memory.detail.edited", { when: edited })}</span></>}
          {n.version != null && <><i className="mdc-sep" data-contrast-exempt>·</i><span>{t("memory.detail.version", { n: n.version })}</span></>}
          {props.onEdit && (
            <Chip className="mdc-edit" onClick={props.onEdit}>
              <Edit size={ICON_SIZE.sm} stroke={1.75} aria-hidden />{t("memory.detail.edit")}
            </Chip>
          )}
        </div>
      </header>

      <div className="mdc-body">
        <RetrievalCard note={n} />

        <div className="mdc-sechead">
          <span className="t-label t-label-s">{t("ui.sections")}</span>
          {/* The label beside it already says "sections", so the count is a
              bare figure here; the spoken name carries the noun. */}
          <span className="mdc-sectally t-num" aria-label={t("memory.detail.sectionCount", { count: views.length })}>
            {views.length}<i className="mdc-sep" data-contrast-exempt>·</i>{chars.toLocaleString()} {t("ui.editor.charUnit")}
          </span>
          <button type="button" className="mdc-all t-label t-label-s" aria-pressed={allOpen} onClick={toggleAll}>
            <span className={`mdc-allglyph ${allOpen ? "is-open" : ""}`}>
              <ExpandSet size={ICON_SIZE.sm} stroke={1.75} aria-hidden />
            </span>
            {allOpen ? t("memory.detail.collapseAll") : t("memory.detail.expandAll")}
          </button>
        </div>

        {views.map((view) => (
          <SectionRow
            key={view.key}
            view={view}
            open={isOpen(view.key)}
            flagOpen={flagKey === view.key}
            onToggle={() => setOpenBySection((prev) => ({ ...prev, [view.key]: !isOpen(view.key) }))}
            onPeek={() => setPeekKey(view.key)}
            onFlag={() => setFlagKey((was) => (was === view.key ? null : view.key))}
          />
        ))}

        {/* The record. Provenance lives in the retrieval block, so the id is
            all that is left down here — and it is the one element with no
            settled home, which is why it stays isolated. */}
        <div className="mdc-record t-data">
          <CopyableText value={n.id} label={t("memory.peek.id")} />
        </div>
      </div>

      {peeked && <SectionPeek view={peeked} onClose={() => setPeekKey(null)} />}
    </div>
  );
}
