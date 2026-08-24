// The one bordered surface on the memory detail screen.
//
// Boxed means metadata, unboxed means content — that is the whole reason this
// block has an edge and nothing else on the screen does. Do not add a second
// card or a nested box here; a box inside the box destroys the distinction the
// screen is built on.
//
// It answers one question: would the engine ever reach this memory? Modes,
// keywords and links are exactly the fields that decide it. `subjects` is not
// here on purpose — on a character memory it names the note itself and carries
// nothing a reader can act on.

import { useState } from "react";
import { useStore } from "../../../lib/store";
import { t } from "../../../copy";
import { KEYWORD_CAP, type Note } from "../api/types";
import { notesById } from "../store";
import { NoteRef } from "../NotePeek";
import { TypeIcon } from "../icons";
import { relationLabel } from "./model";
import { ModePill, Tag } from "../../../ui";
import { Info } from "../../../ui/icons";
import "./RetrievalCard.css";

/** Keywords assumed to survive the single-line clamp. The rail's fade hides an
 *  unknown number of them and only a DOM measurement could say which — and a
 *  measurement runs after first paint, so the counter would render one figure
 *  and then change to another. This is an estimate of what the fade hides, not
 *  a measurement, and it is deterministic before the first render. */
const KEYWORDS_ON_ONE_LINE = 4;

/** Links shown before the block folds.
 *
 *  The card's height must not depend on how much metadata a note carries —
 *  the rule the keyword rail already answers to, and links were left out of
 *  it. The live vault holds notes with 81 and 182 links, which put thousands
 *  of pixels of provenance between the head and the first section. */
const LINKS_SHOWN = 5;

/** Resolve a link target to its title and its type icon; the raw id is the
 *  last resort, never the first. */
function LinkTarget({ id }: { id: string }) {
  const target = useStore(notesById).get(id);
  return (
    <span className="mdc-ret-target">
      {/* The vault's standard way of naming a memory: the type's own glyph in
          the type's hue, then the resolved title. An unresolved target takes
          the hueless type rather than borrowing a taxonomy it may not be in. */}
      <TypeIcon type={target?.type ?? "source"} size={14} />
      <NoteRef id={id} label={target?.title} />
    </span>
  );
}

export function RetrievalCard({ note }: { note: Note }) {
  const [tipOpen, setTipOpen] = useState(false);
  const [kwOpen, setKwOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);

  const keywords = note.keywords ?? [];
  const links = note.links ?? [];
  const hidden = Math.max(0, keywords.length - KEYWORDS_ON_ONE_LINE);
  const toggleKw = () => setKwOpen((open) => !open);

  return (
    <section className="mdc-ret">
      <div className="mdc-ret-head">
        <span>{t("memory.detail.retrieval")}</span>
        <span className="mdc-ret-info">
          <button
            type="button"
            className="mdc-ret-infobtn hit"
            aria-expanded={tipOpen}
            aria-label={t("memory.detail.retrievalWhat")}
            onClick={() => setTipOpen((open) => !open)}
          >
            <Info size={13} stroke={1.75} aria-hidden />
          </button>
          {tipOpen && <span className="mdc-ret-tip">{t("memory.detail.retrievalHelp")}</span>}
        </span>
      </div>

      <div className="mdc-ret-grid">
        <span className="mdc-ret-key">{t("memory.detail.modes")}</span>
        <span className="mdc-ret-val">
          <ModePill modes={note.modes ?? []} />
        </span>

        <span className="mdc-ret-key mdc-ret-key-kw">{t("memoryvault.keywords")}</span>
        {keywords.length > 0 ? (
          <button
            type="button"
            className={`mdc-ret-rail ${kwOpen ? "is-open" : ""}`}
            aria-expanded={kwOpen}
            aria-label={t("memory.detail.keywordRail")}
            onClick={toggleKw}
          >
            {keywords.map((k) => (
              <Tag key={k}>{k}</Tag>
            ))}
          </button>
        ) : (
          <span className="mdc-ret-none">—</span>
        )}

        {keywords.length > 0 && (
          <>
            <span />
            <span className="mdc-ret-kwfoot">
              {hidden > 0 && (
                <button type="button" className="mdc-ret-more" onClick={toggleKw}>
                  {kwOpen
                    ? t("ui.showFewer")
                    : t("ui.moreCount", { count: hidden })}
                </button>
              )}
              <span className="mdc-ret-tally">
                {keywords.length}/{KEYWORD_CAP}
              </span>
            </span>
          </>
        )}

        {links.length > 0 && (
          <>
            <span className="mdc-ret-key mdc-ret-key-links">{t("memory.vault.links")}</span>
            <span className="mdc-ret-links">
              {(linksOpen ? links : links.slice(0, LINKS_SHOWN)).map((link, i) => (
                <span className="mdc-ret-linkrow" key={`${link.relation}:${link.target}:${i}`}>
                  <span className="mdc-ret-rel">{relationLabel(link.relation)}</span>
                  <LinkTarget id={link.target} />
                </span>
              ))}
              {links.length > LINKS_SHOWN && (
                <button
                  type="button"
                  className="mdc-ret-more mdc-ret-linkmore"
                  aria-expanded={linksOpen}
                  onClick={() => setLinksOpen((open) => !open)}
                >
                  {linksOpen ? t("ui.showFewer") : t("ui.moreCount", { count: links.length - LINKS_SHOWN })}
                </button>
              )}
            </span>
          </>
        )}
      </div>
    </section>
  );
}
