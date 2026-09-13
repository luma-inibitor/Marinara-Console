import { useId, useLayoutEffect, useRef, useState } from "react";
import type { Note } from "../api/types";
import { t } from "../../../copy";
import { TypeIcon } from "../icons";
import { Back, Close, Edit, ExpandSet, ICON_SIZE } from "../../../ui/icons";
import { Button, CopyableText, RawJson } from "../../../ui";
import { StatusPill } from "../components/StatusPill";
import { cn, cva } from "../../../ui/cn";
import { After, DL, PILL, Pair, Sep, Word, groundBg, seam, type Ground } from "./chrome";
import { Provenance } from "./Provenance";
import { RetrievalCard } from "./RetrievalCard";
import { SectionRow } from "./SectionRow";
import { Subjects } from "./Subjects";
import { editStamp, sectionViews, startsCollapsed } from "./model";

/** The hue memory.css gives each type. */
const typeTint = cva("text-[color:var(--tc)]", {
  variants: {
    type: {
      source: "type-source",
      timeline_event: "type-timeline_event",
      character: "type-character",
      relationship: "type-relationship",
      scene: "type-scene",
      thread: "type-thread",
      world: "type-world",
      tone: "type-tone",
    },
  },
});

/** A read-only screen for one stored memory. */
export function MemoryDetail(props: {
  note: Note;
  onBack: () => void;
  /** Omitted where the screen has nowhere to send an editor. */
  onEdit?: () => void;
  defaultCollapsed?: boolean;
  /** The overlay projection. */
  peek?: boolean;
  ground?: Ground;
}) {
  const n = props.note;
  const ground = props.ground ?? "canvas";
  const views = sectionViews(n);
  const sectionsId = useId();

  const [allOpen, setAllOpen] = useState(!(props.defaultCollapsed ?? startsCollapsed(n, views.length)));
  const [openBySection, setOpenBySection] = useState<Record<string, boolean>>({});
  const [flagKey, setFlagKey] = useState<string | null>(null);

  const scroller = useRef<HTMLElement>(null);
  const head = useRef<HTMLElement>(null);
  const [headH, setHeadH] = useState(0);

  useLayoutEffect(() => {
    const el = head.current;
    if (!el) return;
    const measure = () => setHeadH(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A closed section shortens the document under the reader.
  const anchorTo = useRef<string | null>(null);
  useLayoutEffect(() => {
    const key = anchorTo.current;
    if (!key) return;
    anchorTo.current = null;
    const box = scroller.current;
    const row = box?.querySelector<HTMLElement>(`[data-section="${CSS.escape(key)}"]`);
    if (!box || !row) return;
    const above = row.getBoundingClientRect().top - (box.getBoundingClientRect().top + headH);
    if (above < 0) box.scrollTop += above;
  });

  const isOpen = (key: string) => openBySection[key] ?? allOpen;
  const toggleSection = (key: string) => {
    if (isOpen(key)) anchorTo.current = key;
    setOpenBySection((prev) => ({ ...prev, [key]: !isOpen(key) }));
  };
  const toggleAll = () => {
    if (allOpen) anchorTo.current = views[0]?.key ?? null;
    setAllOpen((was) => !was);
    setOpenBySection({});
  };

  const chars = views.reduce((sum, v) => sum + v.chars, 0);
  const edited = editStamp(n.updatedAt);
  const created = editStamp(n.createdAt);
  const tags = n.tags ?? [];

  return (
    <article ref={scroller} className={cn("h-full min-h-0 overflow-y-auto", groundBg({ ground }))}>
      <header
        ref={head}
        className={cn("sticky top-0 z-20 border-b border-edge px-3 pt-2", groundBg({ ground }), seam({ ground }))}
      >
        <div className="flex items-center gap-2">
          <Button
            iconOnly
            variant="ghost"
            autoFocus={props.peek}
            label={props.peek ? t("ui.sheet.close") : t("memory.backToVault")}
            onClick={props.onBack}
            icon={
              props.peek ? (
                <Close size={ICON_SIZE.xl} stroke={1.75} aria-hidden />
              ) : (
                <Back size={ICON_SIZE.xl} stroke={1.75} aria-hidden />
              )
            }
          />
          <TypeIcon type={n.type} size={ICON_SIZE.lg} />
          <h1 className="m-0 min-w-0 flex-1 font-label text-head font-semibold [overflow-wrap:anywhere] [font-variation-settings:'wdth'_106]">
            {n.title ?? n.id}
          </h1>
          {props.onEdit && (
            <Button
              size="sm"
              className="shrink-0"
              icon={<Edit size={ICON_SIZE.sm} stroke={1.75} aria-hidden />}
              onClick={props.onEdit}
            >
              {t("memory.detail.edit")}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-[5px] pb-2 pl-[calc(var(--tap)+var(--s2))] t-num text-data-s text-dim">
          <span className={typeTint({ type: n.type })}>{n.type.replaceAll("_", " ")}</span>
          {edited && (
            <After>
              <span>{t("memory.detail.edited", { when: edited })}</span>
            </After>
          )}
          {n.version != null && (
            <After>
              <span>{t("memory.detail.version", { n: n.version })}</span>
            </After>
          )}
          <StatusPill status={n.status} className="ml-auto shrink-0 text-data-s" />
        </div>
      </header>

      <div className="p-[var(--panel-pad)]">
        <RetrievalCard note={n} ground={ground} />
        <Provenance note={n} />
        <Subjects subjects={n.subjects} />

        <section aria-labelledby={sectionsId} className="mt-3">
          <div className="flex min-h-tap items-center gap-2 border-b border-edge">
            <h2 id={sectionsId} className="m-0 t-label t-label-s">
              {t("ui.sections")}
            </h2>
            <span className="t-num text-label text-dim">
              <span className="sr-only">{t("memory.detail.sectionCount", { count: views.length })}</span>
              <span aria-hidden>{views.length}</span>
              <Sep className="mx-[5px]" />
              {chars.toLocaleString()} {t("ui.editor.charUnit")}
            </span>
            <Button
              variant="ghost"
              labelCase="sentence"
              className="ml-auto"
              expanded={allOpen}
              onClick={toggleAll}
              icon={
                <span
                  className={cn(
                    "inline-flex transition-transform [transition-duration:var(--t-fast)]",
                    allOpen && "rotate-180",
                  )}
                >
                  <ExpandSet size={ICON_SIZE.sm} stroke={1.75} aria-hidden />
                </span>
              }
            >
              {allOpen ? t("memory.detail.collapseAll") : t("memory.detail.expandAll")}
            </Button>
          </div>

          {views.map((view) => (
            <SectionRow
              key={view.key}
              view={view}
              open={isOpen(view.key)}
              flagOpen={flagKey === view.key}
              onToggle={() => toggleSection(view.key)}
              onFlag={() => setFlagKey((was) => (was === view.key ? null : view.key))}
              ground={ground}
              stickyTop={headH}
            />
          ))}
        </section>

        <footer className="mt-3">
          <dl className={DL}>
            <Pair k="id">
              <CopyableText value={n.id} label={t("memory.peek.id")} className="max-w-full" />
            </Pair>
            {created && <Pair k={<Word>{t("memoryvault.created")}</Word>}>{created}</Pair>}
            {tags.length > 0 && (
              <Pair k={<Word>{t("memoryvault.tags")}</Word>} top>
                <span className="flex flex-wrap gap-1">
                  {tags.map((tag) => (
                    <span key={tag} className={PILL}>
                      {tag}
                    </span>
                  ))}
                </span>
              </Pair>
            )}
          </dl>
          {props.peek && <RawJson value={n} label={t("memory.peek.rawMemory")} />}
        </footer>
      </div>
    </article>
  );
}
