// The entry editor: a header, the text, then settings cards whose rows share
// one label column. Fields stage into a draft and only Save writes them.
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { tokensOf } from "../../shell/api";
import type { Draft } from "../../shell/draft";
import { closeTopOverlay } from "../../shell/overlays";
import { toast } from "../../shell/toast";
import { readStorage, writeStorage } from "../../lib/storage";
import {
  type CharacterOption,
  type DecisionMode,
  type Entry,
  type FilterMode,
  type Lorebook,
  DECISION_MODES,
  FILTER_MODES,
  GENERATION_TRIGGERS,
  MATCHING_SOURCES,
  POSITIONS,
  POS_COMPACT,
  POS_FULL,
  ROLES,
  SELECTIVE_LOGICS,
  TIMING_FIELDS,
  entryTokens,
} from "./data";
import {
  Accordion,
  Chip,
  ChipEditor,
  HelpTip,
  Input,
  Menu,
  Picker,
  SaveBar,
  SegmentedControl,
  Switch,
  Textarea,
} from "../../ui";
import type { MenuItem, PickerOption } from "../../ui";
import { cn } from "../../ui/cn";
import { t, tAny } from "../../copy";
import { Fullscreen, ICON_SIZE, More } from "../../ui/icons";

export interface FullscreenCtx {
  id: string;
  field: "content" | "description";
}

const SECTIONS = ["keys", "position", "filters", "timing", "decision", "group"] as const;
type Section = (typeof SECTIONS)[number];

const OPEN_KEY = "lorebooks.entry.open";

/** Open sections are shared by every entry and kept across visits. */
function loadOpen(): Set<Section> {
  try {
    const saved = JSON.parse(readStorage(OPEN_KEY) ?? "null") as unknown;
    if (Array.isArray(saved)) return new Set(saved.filter((s): s is Section => SECTIONS.includes(s as Section)));
  } catch {
    // A corrupt value falls back to the default below.
  }
  return new Set(["keys"]);
}

/** Blank stores null, which the engine reads as unset. */
const numberOrNull = (text: string): number | null => {
  const s = text.trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const fmt = (n: number | null | undefined) => (n == null ? "" : String(n));

/** The engine reads `or` as `and` and offers only these four. */
const logicLabel = (l: Entry["selectiveLogic"]) => t(`lorebooks.logic.${l === "or" ? "and" : l}`);

/** A settings card's label column, shared by rows and accordion headers. */
const COLUMNS = "grid items-center gap-x-3 gap-y-2 @md:grid-cols-[12rem_minmax(0,1fr)]";

export function EntryEditor(props: {
  entry: Entry;
  book: Lorebook;
  characters: CharacterOption[];
  /** Non-null when this entry is the active edit target. */
  draft: Draft<Entry> | null;
  evHits: string[];
  onBeginEdit: () => void;
  onSave: () => Promise<boolean>;
  onDelete: () => void;
  onExpand: (field: FullscreenCtx["field"]) => void;
}) {
  const { entry: e, book, draft } = props;
  const [open, setOpen] = useState<Set<Section>>(loadOpen);
  const toggle = (s: Section) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      writeStorage(OPEN_KEY, JSON.stringify([...next]));
      return next;
    });
  const section = (s: Section) => ({ open: open.has(s), onToggle: () => toggle(s) });

  // Staging an edit adopts this entry as the edit target if it isn't already.
  const merge = (patch: Partial<Entry>) => {
    if (!draft) {
      props.onBeginEdit();
      return;
    }
    draft.merge(patch);
  };
  const set = <K extends keyof Entry>(field: K, v: Entry[K]) => merge({ [field]: v } as Partial<Entry>);
  const err = (field: string) => draft?.fieldErrors[field];

  const decision = e.decisionMode ?? "off";
  const bookScan = book.scanDepth ?? 2;
  const charName = (id: string) => props.characters.find((c) => c.id === id)?.name ?? id;

  const filters = [
    [t("lorebooks.entry.characters"), e.characterFilterMode, (e.characterFilterIds ?? []).map(charName)],
    [t("lorebooks.entry.characterTags"), e.characterTagFilterMode, e.characterTagFilters ?? []],
    [
      t("lorebooks.entry.generation"),
      e.generationTriggerFilterMode,
      (e.generationTriggerFilters ?? []).map((g) => tAny(`lorebooks.trigger.${g}`)),
    ],
  ] as const;
  const activeFilters = filters
    .filter(([, mode, names]) => mode && mode !== "any" && names.length)
    .map(([label, mode, names]) => `${label}: ${filterValue(mode!, names)}`);
  const timingSet = TIMING_FIELDS.filter((f) => e[f] != null && e[f] !== 0);
  const noKeys = !e.constant && e.keys.length === 0;

  return (
    <div className="@container flex flex-col bg-canvas">
      <Head
        entry={e}
        recursionLive={!!book.recursiveScanning}
        vectorForced={!!book.excludeFromVectorization}
        set={set}
        onDelete={props.onDelete}
      />

      <div className="flex flex-col gap-4 p-4">
        <Card>
          <div className="flex flex-col gap-2 px-4 pt-3 pb-4">
            <div className="flex min-h-tap-2 items-center gap-2">
              <span className="t-label text-ink">{t("lorebooks.entry.subContent")}</span>
              <HelpTip tip={t("lorebooks.entry.contentTip")} subject={t("lorebooks.entry.subContent")} />
              <span className="ml-auto t-data text-data-s text-dim">
                <b className="text-ink">{(e.content ?? "").length}</b> {t("ui.editor.charUnit")} ·{" "}
                <b className="text-ink">{entryTokens(e)}</b> {t("lorebooks.unitTokens")}
              </span>
              <ExpandChip onClick={() => props.onExpand("content")} />
            </div>
            <Textarea
              className="max-w-none"
              rows={9}
              value={e.content}
              aria-label={t("lorebooks.entry.subContent")}
              aria-invalid={err("content") ? true : undefined}
              onInput={(ev) => set("content", ev.currentTarget.value)}
            />
            {err("content") && <FieldError text={err("content")!} />}
          </div>
        </Card>

        <Card>
          <div className="flex flex-col gap-2 px-4 pt-3 pb-4">
            <div className="flex min-h-tap-2 items-center gap-2">
              <span className="t-label text-ink">{t("lorebooks.entry.subDescription")}</span>
              <HelpTip tip={t("lorebooks.entry.descriptionTip")} subject={t("lorebooks.entry.subDescription")} />
              <span className="ml-auto t-data text-data-s text-dim">
                <b className="text-ink">{tokensOf(e.description)}</b> {t("lorebooks.unitTokens")}
              </span>
              <ExpandChip onClick={() => props.onExpand("description")} />
            </div>
            <Textarea
              className="max-w-none"
              rows={2}
              value={e.description}
              placeholder={t("lorebooks.entry.descriptionPlaceholder")}
              aria-label={t("lorebooks.entry.subDescription")}
              aria-invalid={err("description") ? true : undefined}
              onInput={(ev) => set("description", ev.currentTarget.value)}
            />
          </div>
          <Row label={t("lorebooks.entry.tag")}>
            <Input
              className="max-w-80"
              value={e.tag ?? ""}
              placeholder={t("lorebooks.entry.tagPlaceholder")}
              aria-label={t("lorebooks.entry.tag")}
              onInput={(ev) => set("tag", ev.currentTarget.value)}
            />
          </Row>
        </Card>

        <Card>
          <Row label={t("lorebooks.entry.type")}>
            <SegmentedControl
              label={t("lorebooks.entry.type")}
              value={e.constant ? "constant" : "normal"}
              segments={[
                { id: "normal", label: t("lorebooks.status.normal"), tone: "ok" },
                { id: "constant", label: t("lorebooks.status.constant"), tone: "warn" },
              ]}
              onChange={(v) =>
                merge(
                  v === "constant"
                    ? { constant: true, ...(decision === "trigger" ? { decisionMode: "require" as const } : {}) }
                    : { constant: false },
                )
              }
            />
          </Row>

          <Accordion
            {...section("keys")}
            label={t("lorebooks.entry.subKeys")}
            tip={t("lorebooks.entry.keysTip")}
            error={!!err("keys")}
            unavailable={e.constant}
            summaryTone={noKeys ? "danger" : e.constant ? undefined : "set"}
            summary={
              e.constant ? (
                t("lorebooks.row.alwaysInjected")
              ) : noKeys ? (
                t("lorebooks.row.noKeys")
              ) : (
                <>
                  {e.keys.length} {t("lorebooks.field.keys")}
                  {e.selective && e.secondaryKeys.length > 0 && (
                    <>
                      {" "}
                      · {logicLabel(e.selectiveLogic)} {e.secondaryKeys.length}
                    </>
                  )}
                </>
              )
            }
          >
            <ChipEditor
              values={e.keys}
              highlight={props.evHits}
              label={t("lorebooks.entry.subKeys")}
              placeholder={t("lorebooks.entry.addKeyPlaceholder")}
              onChange={(keys) => set("keys", keys)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Chip pressed={!!e.matchWholeWords} onClick={() => set("matchWholeWords", !e.matchWholeWords)}>
                {t("lorebooks.entry.wholeWords")}
              </Chip>
              <Chip pressed={!!e.caseSensitive} onClick={() => set("caseSensitive", !e.caseSensitive)}>
                {t("lorebooks.entry.caseSensitive")}
              </Chip>
              <Chip pressed={!!e.useRegex} onClick={() => set("useRegex", !e.useRegex)}>
                {t("lorebooks.entry.regex")}
              </Chip>
            </div>
            <SubRow label={t("lorebooks.entry.scanDepth")} tip={t("lorebooks.entry.scanDepthTip", { value: bookScan })}>
              <NumberInput
                label={t("lorebooks.entry.scanDepth")}
                value={e.scanDepth}
                placeholder={String(bookScan)}
                onChange={(v) => set("scanDepth", v == null ? null : Math.max(0, Math.floor(v)))}
              />
            </SubRow>
            <SubRow label={t("lorebooks.entry.secondaryKeys")} tip={t("lorebooks.entry.secondaryTip")}>
              <div className="flex flex-wrap items-center gap-2">
                <Switch
                  checked={e.selective}
                  label={t("lorebooks.entry.secondaryKeys")}
                  onChange={(on) => set("selective", on)}
                />
                {e.selective && (
                  <Picker
                    label={t("lorebooks.entry.logic")}
                    value={e.selectiveLogic === "or" ? "and" : e.selectiveLogic}
                    options={SELECTIVE_LOGICS.map((l) => ({ id: l, label: logicLabel(l) }))}
                    onChange={(v) => set("selectiveLogic", v as Entry["selectiveLogic"])}
                  />
                )}
              </div>
            </SubRow>
            {e.selective && (
              <ChipEditor
                values={e.secondaryKeys}
                highlight={props.evHits}
                label={t("lorebooks.entry.secondaryKeys")}
                placeholder={t("lorebooks.entry.addKeyPlaceholder")}
                onChange={(keys) => set("secondaryKeys", keys)}
              />
            )}
          </Accordion>

          <Row label={t("lorebooks.entry.probability")} tip={t("lorebooks.entry.probabilityTip")}>
            <NumberInput
              label={t("lorebooks.entry.probability")}
              value={e.probability}
              placeholder="100"
              unit="%"
              flag={e.probability != null && e.probability < 100}
              onChange={(v) => set("probability", v == null || v >= 100 ? null : Math.max(0, v))}
            />
          </Row>

          <Accordion
            {...section("filters")}
            label={t("lorebooks.entry.filters")}
            summaryTone={activeFilters.length ? "flag" : undefined}
            summary={activeFilters.length ? activeFilters.join(" · ") : t("lorebooks.mode.any")}
          >
            <FilterRow
              label={t("lorebooks.entry.characters")}
              mode={e.characterFilterMode ?? "any"}
              value={e.characterFilterIds ?? []}
              options={props.characters.map((c) => ({ id: c.id, label: c.name }))}
              onChange={(mode, ids) => merge({ characterFilterMode: mode, characterFilterIds: ids })}
            />
            <FilterRow
              label={t("lorebooks.entry.characterTags")}
              mode={e.characterTagFilterMode ?? "any"}
              value={e.characterTagFilters ?? []}
              options={characterTagOptions(props.characters, e.characterTagFilters ?? [])}
              onChange={(mode, tags) => merge({ characterTagFilterMode: mode, characterTagFilters: tags })}
            />
            <FilterRow
              label={t("lorebooks.entry.generation")}
              mode={e.generationTriggerFilterMode ?? "any"}
              value={e.generationTriggerFilters ?? []}
              options={GENERATION_TRIGGERS.map((g) => ({ id: g, label: tAny(`lorebooks.trigger.${g}`) }))}
              onChange={(mode, ids) => merge({ generationTriggerFilterMode: mode, generationTriggerFilters: ids })}
            />
            <SubRow label={t("lorebooks.entry.sources")} tip={t("lorebooks.entry.sourcesTip")}>
              <Picker
                multi
                label={t("lorebooks.entry.sources")}
                noneLabel={t("ui.mode.none")}
                value={e.additionalMatchingSources ?? []}
                options={MATCHING_SOURCES.map((s) => ({
                  id: s,
                  label: s === "character_tags" ? t("lorebooks.entry.characterTags") : tAny(`lorebooks.source.${s}`),
                }))}
                onChange={(ids) => set("additionalMatchingSources", ids)}
              />
            </SubRow>
          </Accordion>

          <Accordion
            {...section("timing")}
            label={t("lorebooks.entry.timing")}
            tip={t("lorebooks.entry.timingTip")}
            summaryTone={timingSet.some((f) => f !== "sticky") ? "flag" : timingSet.length ? "set" : undefined}
            summary={
              timingSet.length
                ? timingSet.map((f) => `${t(`lorebooks.timing.${f}`)} ${e[f]}`).join(" · ")
                : t("lorebooks.entry.off")
            }
          >
            <div className="grid max-w-xl grid-cols-2 gap-3 @xl:grid-cols-4">
              {TIMING_FIELDS.map((f) => (
                <label key={f} className="flex flex-col gap-1">
                  <span className="t-label text-dim">{t(`lorebooks.timing.${f}`)}</span>
                  <Input
                    className="text-right tabular-nums"
                    inputMode="numeric"
                    value={fmt(e[f])}
                    placeholder={t("lorebooks.entry.off")}
                    onInput={(ev) => {
                      const v = numberOrNull(ev.currentTarget.value);
                      set(f, v == null || v <= 0 ? null : Math.floor(v));
                    }}
                  />
                </label>
              ))}
            </div>
          </Accordion>

          <Accordion
            {...section("decision")}
            label={t("lorebooks.entry.decision")}
            tip={t("lorebooks.entry.decisionTip")}
            summaryTone={decision === "require" ? "flag" : decision === "trigger" ? "set" : undefined}
            summary={decision === "off" ? t("lorebooks.entry.off") : t(`lorebooks.decision.${decision}`)}
          >
            <SegmentedControl
              label={t("lorebooks.entry.decision")}
              value={decision}
              segments={DECISION_MODES.map((m) => ({
                id: m,
                label: m === "off" ? t("lorebooks.entry.off") : t(`lorebooks.decision.${m}`),
                disabledReason: m === "trigger" && e.constant ? t("lorebooks.entry.triggerConstant") : undefined,
              }))}
              onChange={(m) => set("decisionMode", m as DecisionMode)}
            />
            {decision !== "off" && (
              <SubRow
                label={t("lorebooks.entry.decisionStatement")}
                tip={decision === "require" ? t("lorebooks.entry.requireHint") : t("lorebooks.entry.triggerHint")}
                top
              >
                <Textarea
                  className="max-w-none"
                  rows={2}
                  value={e.decisionStatement ?? ""}
                  placeholder={t("lorebooks.entry.decisionPlaceholder")}
                  aria-label={t("lorebooks.entry.decisionStatement")}
                  onInput={(ev) => set("decisionStatement", ev.currentTarget.value)}
                />
              </SubRow>
            )}
          </Accordion>
        </Card>

        <Card>
          <Accordion
            {...section("position")}
            label={t("presets.position")}
            tip={t("lorebooks.entry.positionTip")}
            summaryTone={e.position !== 0 || e.order !== 100 ? "set" : undefined}
            summary={
              <>
                {POS_FULL[e.position] ?? ""}
                {e.position === 2 && ` ${e.depth}`} · {t("lorebooks.field.order")} {e.order}
              </>
            }
          >
            <SegmentedControl
              label={t("presets.position")}
              labelCase="sentence"
              value={e.position}
              segments={POSITIONS.map((p) => ({ id: p, label: POS_COMPACT[p] ?? "", name: POS_FULL[p] }))}
              onChange={(p) => set("position", p)}
            />
            {e.position === 2 && (
              <>
                <SubRow label={t("lorebooks.entry.depth")} tip={t("lorebooks.entry.depthTip")}>
                  <NumberInput
                    label={t("lorebooks.entry.depth")}
                    value={e.depth}
                    placeholder="4"
                    onChange={(v) => set("depth", v == null ? 4 : Math.max(0, Math.floor(v)))}
                  />
                </SubRow>
                <SubRow label={t("presets.role")} tip={t("lorebooks.entry.roleTip")}>
                  <Picker
                    label={t("presets.role")}
                    value={e.role ?? "system"}
                    options={ROLES.map((r) => ({ id: r, label: t(`lorebooks.role.${r}`) }))}
                    onChange={(v) => set("role", v as Entry["role"])}
                  />
                </SubRow>
              </>
            )}
            {e.position === 7 && (
              <SubRow label={t("lorebooks.entry.outletName")}>
                <Input
                  className="max-w-80"
                  value={e.outletName}
                  placeholder={t("lorebooks.entry.outletPlaceholder")}
                  aria-label={t("lorebooks.entry.outletName")}
                  onInput={(ev) => set("outletName", ev.currentTarget.value)}
                />
              </SubRow>
            )}
            <SubRow label={t("lorebooks.field.order")} tip={t("lorebooks.entry.orderTip")}>
              <NumberInput
                label={t("lorebooks.field.order")}
                value={e.order}
                placeholder="100"
                onChange={(v) => set("order", v ?? 100)}
              />
            </SubRow>
          </Accordion>

          <Accordion
            {...section("group")}
            label={t("memory.review.group")}
            tip={t("lorebooks.entry.groupTip")}
            summaryTone={e.group ? "set" : undefined}
            summary={e.group ? `${e.group}${e.groupWeight != null ? ` · ${e.groupWeight}` : ""}` : t("ui.mode.none")}
          >
            <SubRow label={t("lorebooks.entry.groupName")}>
              <Input
                className="max-w-80"
                value={e.group ?? ""}
                aria-label={t("lorebooks.entry.groupName")}
                onInput={(ev) => set("group", ev.currentTarget.value)}
              />
            </SubRow>
            <SubRow label={t("lorebooks.entry.groupWeight")}>
              <NumberInput
                label={t("lorebooks.entry.groupWeight")}
                value={e.groupWeight}
                placeholder="100"
                onChange={(v) => set("groupWeight", v)}
              />
            </SubRow>
          </Accordion>
        </Card>
      </div>

      {draft && <SaveBar draft={draft} onSave={props.onSave} conflictBody="lorebooks.entry.conflictBody" />}
    </div>
  );
}

const filterValue = (mode: FilterMode, names: readonly string[]) =>
  t("lorebooks.entry.filterSummary", { value1: t(`lorebooks.mode.${mode}`), value2: names.join(", ") });

/** Every tag on every character, plus any the entry names that no card carries now. */
function characterTagOptions(characters: CharacterOption[], chosen: string[]): PickerOption[] {
  const tags = new Set<string>(chosen);
  for (const c of characters) for (const tag of c.tags) tags.add(tag);
  return [...tags].sort((a, b) => a.localeCompare(b)).map((tag) => ({ id: tag, label: tag }));
}

// ── header ──

function Head(props: {
  entry: Entry;
  recursionLive: boolean;
  vectorForced: boolean;
  set: <K extends keyof Entry>(field: K, v: Entry[K]) => void;
  onDelete: () => void;
}) {
  const { entry: e, set } = props;
  const [menu, setMenu] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const items: MenuItem[] = [
    {
      id: "locked",
      label: t("lorebooks.entry.locked"),
      check: "checkbox",
      checked: !!e.locked,
      onSelect: () => set("locked", !e.locked),
    },
    {
      id: "recursion",
      label: t("lorebooks.entry.recursion"),
      check: "checkbox",
      // The engine defaults preventRecursion to true, so only an explicit false is on.
      checked: e.preventRecursion === false,
      disabledReason: props.recursionLive ? undefined : t("lorebooks.entry.recursionOff"),
      onSelect: () => set("preventRecursion", e.preventRecursion === false),
    },
    {
      id: "novector",
      label: t("lorebooks.entry.noVector"),
      check: "checkbox",
      checked: props.vectorForced || !!e.excludeFromVectorization,
      disabledReason: props.vectorForced ? t("lorebooks.entry.noVectorForced") : undefined,
      onSelect: () => set("excludeFromVectorization", !e.excludeFromVectorization),
    },
    {
      id: "copy",
      label: t("lorebooks.entry.copyId"),
      onSelect: () => {
        navigator.clipboard.writeText(e.id).then(
          () => toast(t("lorebooks.entry.idCopied")),
          () => toast(t("lorebooks.entry.copyIdFailed"), { kind: "error" }),
        );
      },
    },
    { id: "delete", label: t("lorebooks.entry.delete"), onSelect: props.onDelete },
  ];
  return (
    <div className="flex items-center gap-2 border-b border-edge bg-surface-1 px-3 py-2">
      <Switch checked={e.enabled} label={t("lorebooks.entry.enabled")} onChange={(on) => set("enabled", on)} />
      <span
        aria-hidden
        className={cn(
          "size-2.5 shrink-0 rounded-full",
          !e.enabled ? "border-[1.5px] border-edge-control" : e.constant ? "bg-warn" : "bg-ok",
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <input
          className={cn(
            "min-h-tap w-full min-w-0 rounded-sm border border-transparent bg-transparent px-2 font-prose text-head font-semibold",
            e.enabled ? "text-ink" : "text-dim",
            "placeholder:text-dim hover:border-edge-control focus-visible:border-edge-control",
            "focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none",
          )}
          value={e.name}
          placeholder={t("lorebooks.entry.untitled")}
          aria-label={t("lorebooks.entry.nameLabel")}
          onInput={(ev) => set("name", ev.currentTarget.value)}
        />
        <span
          className={cn(
            "truncate px-2 t-data text-data-s",
            !e.constant && e.keys.length === 0 ? "text-danger" : "text-dim",
          )}
        >
          {e.constant
            ? t("lorebooks.row.alwaysInjected")
            : e.keys.length
              ? e.keys.join(" · ")
              : t("lorebooks.row.noKeys")}
        </span>
      </div>
      {e.locked && <span className="t-label text-dim">{t("lorebooks.entry.locked")}</span>}
      {/* eslint-disable-next-line local/no-raw-button -- the Menu needs the trigger element as its anchor */}
      <button
        ref={anchor}
        type="button"
        className={cn(
          "inline-flex min-h-tap w-tap shrink-0 items-center justify-center rounded-md text-dim hover:text-ink",
          "focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none aria-expanded:bg-surface-3 aria-expanded:text-ink",
        )}
        aria-label={t("lorebooks.entry.controls")}
        aria-haspopup="menu"
        aria-expanded={menu}
        onClick={() => (menu ? closeTopOverlay() : setMenu(true))}
      >
        <More size={ICON_SIZE.md} stroke={1.75} aria-hidden />
      </button>
      <Menu
        open={menu}
        anchor={anchor}
        label={t("lorebooks.entry.controls")}
        align="end"
        items={items}
        onClose={() => setMenu(false)}
      />
    </div>
  );
}

// ── parts ──

function Card(props: { children: ReactNode }) {
  return <section className="overflow-hidden rounded-lg border border-edge bg-surface-1">{props.children}</section>;
}

/** A card row: label and help in the label column, the control in the value column. */
function Row(props: { label: string; tip?: string; top?: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(COLUMNS, "min-h-tap border-t border-edge px-4 py-2 first:border-t-0", props.top && "items-start")}
    >
      <span className={cn("flex items-center gap-2", props.top && "@md:pt-2")}>
        <span className="t-label text-ink">{props.label}</span>
        {props.tip && <HelpTip tip={props.tip} subject={props.label} />}
      </span>
      <div className="min-w-0">{props.children}</div>
    </div>
  );
}

/** A row inside an open accordion, one step down in the hierarchy. */
function SubRow(props: { label: string; tip?: string; top?: boolean; children: ReactNode }) {
  return (
    <div className={cn(COLUMNS, props.top && "items-start")}>
      <span className={cn("flex items-center gap-2", props.top && "@md:pt-2")}>
        <span className="t-label text-dim">{props.label}</span>
        {props.tip && <HelpTip tip={props.tip} subject={props.label} />}
      </span>
      <div className="min-w-0">{props.children}</div>
    </div>
  );
}

function ExpandChip(props: { onClick: () => void }) {
  return (
    <Chip onClick={props.onClick} title={t("lorebooks.record.editFullscreen")}>
      <Fullscreen size={ICON_SIZE.sm} stroke={2} aria-hidden />
      <span className="sr-only">{t("lorebooks.record.editFullscreen")}</span>
    </Chip>
  );
}

function NumberInput(props: {
  label: string;
  value: number | null | undefined;
  placeholder: string;
  unit?: string;
  /** The value can stop the entry from firing. */
  flag?: boolean;
  onChange: (v: number | null) => void;
}) {
  return (
    <span className="flex w-32 items-center gap-2">
      <Input
        className={cn("text-right tabular-nums", props.flag && "border-flag! text-flag!")}
        inputMode="numeric"
        aria-label={props.label}
        value={fmt(props.value)}
        placeholder={props.placeholder}
        onInput={(ev) => props.onChange(numberOrNull(ev.currentTarget.value))}
      />
      {props.unit && props.value != null && <span className="t-data text-data-s text-dim">{props.unit}</span>}
    </span>
  );
}

function FieldError(props: { text: string }) {
  return (
    <p className="t-data text-data-s text-danger" role="alert">
      {props.text}
    </p>
  );
}

function FilterRow(props: {
  label: string;
  mode: FilterMode;
  value: string[];
  options: PickerOption[];
  onChange: (mode: FilterMode, value: string[]) => void;
}) {
  return (
    <SubRow label={props.label}>
      <div className="flex flex-wrap items-center gap-2">
        <Picker
          label={props.label}
          value={props.mode}
          options={FILTER_MODES.map((m) => ({ id: m, label: t(`lorebooks.mode.${m}`) }))}
          onChange={(m) => props.onChange(m as FilterMode, props.value)}
        />
        {props.mode !== "any" && (
          <Picker
            multi
            className="min-w-0 flex-1"
            label={props.label}
            noneLabel={t("ui.mode.none")}
            value={props.value}
            options={props.options}
            onChange={(ids) => props.onChange(props.mode, ids)}
          />
        )}
      </div>
    </SubRow>
  );
}
