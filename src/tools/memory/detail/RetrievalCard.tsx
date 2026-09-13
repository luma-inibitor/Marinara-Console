import { useId, useState } from "react";
import { t } from "../../../copy";
import type { Note } from "../api/types";
import { KEYWORD_CAP } from "../model/caps";
import { effectiveKeywords, splitKeywords } from "../model/keywords";
import { LinkTarget, MemoryRef } from "../components/NoteRef";
import { relationLabel } from "../model/relations";
import { Button, Edu, ModePill, Term } from "../../../ui";
import { Info, ICON_SIZE } from "../../../ui/icons";
import { cn, cva } from "../../../ui/cn";
import { After, DL, PILL, Pair, TARGET, TARGET_LINK, Word, raisedBg, type Ground } from "./chrome";
import { scopeEntries, type Scope } from "./model";

/** Keywords assumed to fit the one-line clamp. */
const KEYWORDS_ON_ONE_LINE = 4;

/** Links shown before the block folds. */
const LINKS_SHOWN = 5;

const rail = cva(
  "flex w-full min-w-0 items-center gap-2 rounded-sm text-left focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none",
  {
    variants: {
      open: {
        true: "h-auto flex-wrap overflow-visible",
        false:
          "h-7 flex-nowrap overflow-hidden [mask-image:linear-gradient(90deg,#000_calc(100%-52px),transparent)] [mask-repeat:no-repeat] focus-visible:[mask-image:none]",
      },
    },
  },
);

function Key(props: { tip?: string; children: string }) {
  const text = <Word>{props.children}</Word>;
  return props.tip ? <Term tip={props.tip}>{text}</Term> : text;
}

/** The scope's families and their ids. */
export function ScopeList({ scope }: { scope: Scope | undefined }) {
  const entries = scopeEntries(scope);
  if (entries.length === 0) return <span className="text-dim">{t("memoryvault.availableEverywhere")}</span>;
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {entries.map((e) => (
        <li key={e.field} className="flex min-w-0 flex-wrap gap-x-2">
          <span className="text-dim">{e.field}</span>
          <span className="[overflow-wrap:anywhere]">{e.ids.join(", ")}</span>
        </li>
      ))}
    </ul>
  );
}

function CardTarget({ id }: { id: string }) {
  return (
    <LinkTarget
      id={id}
      className={TARGET}
      linkClassName={TARGET_LINK}
      unresolved={<MemoryRef id={id} title={id} type="source" className={TARGET} linkClassName={TARGET_LINK} />}
    />
  );
}

export function RetrievalCard({ note, ground = "canvas" }: { note: Note; ground?: Ground }) {
  const headingId = useId();
  const [tipOpen, setTipOpen] = useState(false);
  const [kwOpen, setKwOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);

  const keywords = effectiveKeywords(note);
  const { manual, suppressed } = splitKeywords(note);
  const links = note.links ?? [];
  const hidden = Math.max(0, keywords.length - KEYWORDS_ON_ONE_LINE);
  const toggleKw = () => setKwOpen((open) => !open);

  return (
    <section
      aria-labelledby={headingId}
      className={cn("rounded-md border border-edge px-3 py-2", raisedBg({ ground }))}
    >
      <div className="mb-[6px] flex items-center gap-2">
        <h2 id={headingId} className="m-0 t-label t-label-s">
          {t("memory.detail.retrieval")}
        </h2>
        <Button
          iconOnly
          variant="ghost"
          size="sm"
          className="ml-auto"
          label={t("memory.detail.retrievalWhat")}
          expanded={tipOpen}
          onClick={() => setTipOpen((open) => !open)}
          icon={<Info size={ICON_SIZE.sm} stroke={1.75} aria-hidden />}
        />
      </div>
      {tipOpen && (
        <div className="mb-2">
          <Edu>{t("memory.detail.retrievalHelp")}</Edu>
        </div>
      )}

      <dl className={DL}>
        <Pair k={<Key tip={t("memoryvault.modesHelp")}>{t("memory.detail.modes")}</Key>}>
          <span className="inline-flex min-w-0">
            <ModePill modes={note.modes ?? []} />
          </span>
        </Pair>

        <Pair k={<Key>{t("memoryvault.keywords")}</Key>} top={keywords.length > 0}>
          {keywords.length > 0 ? (
            <button
              type="button"
              className={rail({ open: kwOpen })}
              aria-expanded={kwOpen}
              aria-label={t("memory.detail.keywordRail")}
              onClick={toggleKw}
            >
              {keywords.map((k) => (
                <span key={k} className={PILL}>
                  {k}
                </span>
              ))}
            </button>
          ) : (
            <span className="text-dim">—</span>
          )}
        </Pair>
        {keywords.length > 0 && (
          <dd className="col-start-2 m-0 flex flex-wrap items-center gap-x-[6px] gap-y-1 text-dim">
            {hidden > 0 && (
              <Button variant="ghost" size="sm" labelCase="sentence" expanded={kwOpen} onClick={toggleKw}>
                {kwOpen ? t("ui.showFewer") : t("ui.moreCount", { count: hidden })}
              </Button>
            )}
            <span className="tabular-nums">
              {t("memoryvault.addedManually")} {manual.length}/{KEYWORD_CAP}
            </span>
            {suppressed.length > 0 && (
              <After>
                <span className="tabular-nums">{t("memory.detail.suppressed", { count: suppressed.length })}</span>
              </After>
            )}
          </dd>
        )}

        <Pair k={<Key tip={t("memoryvault.scopeHelp")}>{t("memoryvault.scope")}</Key>} top>
          <ScopeList scope={note.scope} />
        </Pair>

        {links.length > 0 && (
          <Pair k={<Key>{t("memory.vault.links")}</Key>} top>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {(linksOpen ? links : links.slice(0, LINKS_SHOWN)).map((link, i) => (
                <li key={`${link.relation}:${link.target}:${i}`} className="flex min-w-0 items-center gap-[6px]">
                  <span className="shrink-0 font-prose text-data whitespace-nowrap text-dim">
                    {relationLabel(link.relation)}
                  </span>
                  <CardTarget id={link.target} />
                </li>
              ))}
            </ul>
            {links.length > LINKS_SHOWN && (
              <Button
                variant="ghost"
                size="sm"
                labelCase="sentence"
                className="mt-2"
                expanded={linksOpen}
                onClick={() => setLinksOpen((open) => !open)}
              >
                {linksOpen ? t("ui.showFewer") : t("ui.moreCount", { count: links.length - LINKS_SHOWN })}
              </Button>
            )}
          </Pair>
        )}
      </dl>
    </section>
  );
}
