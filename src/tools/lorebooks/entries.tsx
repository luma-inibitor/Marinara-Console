// The entry editor: a header, the text, then one accordion per question the
// engine asks of an entry. Fields stage into a draft and only Save writes them.
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
  Field,
  HelpTip,
  Input,
  Menu,
  Picker,
  SaveBar,
  SegmentedControl,
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

const LABEL = "t-label t-label-s text-dim";

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

  return (
    <div className="flex flex-col bg-surface-2">
      <Head
        entry={e}
        recursionLive={!!book.recursiveScanning}
        vectorForced={!!book.excludeFromVectorization}
        set={set}
        onDelete={props.onDelete}
      />

      <div className="flex flex-col gap-4 border-b border-edge px-3 pt-3 pb-4">
        <div className="flex items-center gap-2">
          <span className={LABEL}>{t("lorebooks.entry.type")}</span>
          <SegmentedControl
            className="ml-auto"
            label={t("lorebooks.entry.type")}
            value={e.constant ? "constant" : "normal"}
            segments={[
              { id: "normal", label: t("lorebooks.status.normal") },
              { id: "constant", label: t("lorebooks.status.constant") },
            ]}
            onChange={(v) =>
              merge(
                v === "constant"
                  ? { constant: true, ...(decision === "trigger" ? { decisionMode: "require" as const } : {}) }
                  : { constant: false },
              )
            }
          />
        </div>

        <TextBlock
          label={t("lorebooks.entry.subContent")}
          tip={t("lorebooks.entry.contentTip")}
          meta={
            <>
              <b className="text-ink">{(e.content ?? "").length}</b> {t("ui.editor.charUnit")} ·{" "}
              <b className="text-ink">{entryTokens(e)}</b> {t("lorebooks.unitTokens")}
            </>
          }
          onExpand={() => props.onExpand("content")}
        >
          <Textarea
            className="max-w-none"
            rows={8}
            value={e.content}
            aria-label={t("lorebooks.entry.subContent")}
            aria-invalid={err("content") ? true : undefined}
            onInput={(ev) => set("content", ev.currentTarget.value)}
          />
          {err("content") && <FieldError text={err("content")!} />}
        </TextBlock>

        <div className="grid items-start gap-4 min-[720px]:grid-cols-[minmax(0,1fr)_minmax(0,12rem)]">
          <TextBlock
            label={t("lorebooks.entry.subDescription")}
            tip={t("lorebooks.entry.descriptionTip")}
            meta={
              <>
                <b className="text-ink">{tokensOf(e.description)}</b> {t("lorebooks.unitTokens")}
              </>
            }
            onExpand={() => props.onExpand("description")}
          >
            <Textarea
              className="max-w-none"
              rows={2}
              value={e.description}
              placeholder={t("lorebooks.entry.descriptionPlaceholder")}
              aria-label={t("lorebooks.entry.subDescription")}
              aria-invalid={err("description") ? true : undefined}
              onInput={(ev) => set("description", ev.currentTarget.value)}
            />
          </TextBlock>
          <TextBlock label={t("lorebooks.entry.tag")}>
            <Input
              value={e.tag ?? ""}
              placeholder={t("lorebooks.entry.tagPlaceholder")}
              aria-label={t("lorebooks.entry.tag")}
              onInput={(ev) => set("tag", ev.currentTarget.value)}
            />
          </TextBlock>
        </div>
      </div>

      <Accordion
        {...section("keys")}
        label={t("lorebooks.entry.subKeys")}
        tip={t("lorebooks.entry.keysTip")}
        error={!!err("keys")}
        unavailable={e.constant}
        summary={
          e.constant ? (
            t("lorebooks.row.alwaysInjected")
          ) : (
            <>
              <b className="text-ink">{e.keys.length}</b> {t("lorebooks.field.keys")}
              {e.selective && e.secondaryKeys.length > 0 && (
                <>
                  {" "}
                  · {logicLabel(e.selectiveLogic)} <b className="text-ink">{e.secondaryKeys.length}</b>
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
        <SettingRow label={t("lorebooks.entry.scanDepth")} tip={t("lorebooks.entry.scanDepthTip", { value: bookScan })}>
          <NumberInput
            label={t("lorebooks.entry.scanDepth")}
            value={e.scanDepth}
            placeholder={String(bookScan)}
            onChange={(v) => set("scanDepth", v == null ? null : Math.max(0, Math.floor(v)))}
          />
        </SettingRow>
        <div className="flex flex-col gap-3 border-t border-edge pt-3">
          <SettingRow label={t("lorebooks.entry.secondaryKeys")} tip={t("lorebooks.entry.secondaryTip")}>
            {e.selective && (
              <Picker
                label={t("lorebooks.entry.logic")}
                value={e.selectiveLogic === "or" ? "and" : e.selectiveLogic}
                options={SELECTIVE_LOGICS.map((l) => ({ id: l, label: logicLabel(l) }))}
                onChange={(v) => set("selectiveLogic", v as Entry["selectiveLogic"])}
              />
            )}
            <Chip pressed={e.selective} onClick={() => set("selective", !e.selective)}>
              {e.selective ? t("lorebooks.entry.enabled") : t("lorebooks.entry.off")}
            </Chip>
          </SettingRow>
          {e.selective && (
            <ChipEditor
              values={e.secondaryKeys}
              highlight={props.evHits}
              label={t("lorebooks.entry.secondaryKeys")}
              placeholder={t("lorebooks.entry.addKeyPlaceholder")}
              onChange={(keys) => set("secondaryKeys", keys)}
            />
          )}
        </div>
      </Accordion>

      <div className="border-b border-edge px-3 py-1">
        <SettingRow label={t("lorebooks.entry.probability")} tip={t("lorebooks.entry.probabilityTip")}>
          <NumberInput
            label={t("lorebooks.entry.probability")}
            value={e.probability}
            placeholder={t("lorebooks.entry.probabilityPlaceholder")}
            unit="%"
            wide
            onChange={(v) => set("probability", v == null || v >= 100 ? null : Math.max(0, v))}
          />
        </SettingRow>
      </div>

      <Accordion
        {...section("position")}
        label={t("presets.position")}
        tip={t("lorebooks.entry.positionTip")}
        summary={
          <>
            {POS_FULL[e.position] ?? ""}
            {e.position === 2 && ` ${e.depth}`} · {t("lorebooks.field.order")} <b className="text-ink">{e.order}</b>
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
            <SettingRow label={t("lorebooks.entry.depth")} tip={t("lorebooks.entry.depthTip")}>
              <NumberInput
                label={t("lorebooks.entry.depth")}
                value={e.depth}
                placeholder="4"
                onChange={(v) => set("depth", v == null ? 4 : Math.max(0, Math.floor(v)))}
              />
            </SettingRow>
            <SettingRow label={t("presets.role")} tip={t("lorebooks.entry.roleTip")}>
              <Picker
                label={t("presets.role")}
                value={e.role ?? "system"}
                options={ROLES.map((r) => ({ id: r, label: t(`lorebooks.role.${r}`) }))}
                onChange={(v) => set("role", v as Entry["role"])}
              />
            </SettingRow>
          </>
        )}
        {e.position === 7 && (
          <Field label={t("lorebooks.entry.outletName")}>
            <Input
              value={e.outletName}
              placeholder={t("lorebooks.entry.outletPlaceholder")}
              onInput={(ev) => set("outletName", ev.currentTarget.value)}
            />
          </Field>
        )}
        <SettingRow label={t("lorebooks.field.order")} tip={t("lorebooks.entry.orderTip")}>
          <NumberInput
            label={t("lorebooks.field.order")}
            value={e.order}
            placeholder="100"
            onChange={(v) => set("order", v ?? 100)}
          />
        </SettingRow>
      </Accordion>

      <Accordion
        {...section("filters")}
        label={t("lorebooks.entry.filters")}
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
        <div className="border-t border-edge pt-3">
          <SettingRow label={t("lorebooks.entry.sources")} tip={t("lorebooks.entry.sourcesTip")}>
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
          </SettingRow>
        </div>
      </Accordion>

      <Accordion
        {...section("timing")}
        label={t("lorebooks.entry.timing")}
        tip={t("lorebooks.entry.timingTip")}
        summary={
          timingSet.length
            ? timingSet.map((f) => `${t(`lorebooks.timing.${f}`)} ${e[f]}`).join(" · ")
            : t("lorebooks.entry.off")
        }
      >
        <div className="grid grid-cols-2 gap-3 min-[720px]:grid-cols-4">
          {TIMING_FIELDS.map((f) => (
            <Field key={f} label={t(`lorebooks.timing.${f}`)}>
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
            </Field>
          ))}
        </div>
      </Accordion>

      <Accordion
        {...section("decision")}
        label={t("lorebooks.entry.decision")}
        tip={t("lorebooks.entry.decisionTip")}
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
          <TextBlock
            label={t("lorebooks.entry.decisionStatement")}
            tip={decision === "require" ? t("lorebooks.entry.requireHint") : t("lorebooks.entry.triggerHint")}
          >
            <Textarea
              className="max-w-none"
              rows={2}
              value={e.decisionStatement ?? ""}
              placeholder={t("lorebooks.entry.decisionPlaceholder")}
              aria-label={t("lorebooks.entry.decisionStatement")}
              onInput={(ev) => set("decisionStatement", ev.currentTarget.value)}
            />
          </TextBlock>
        )}
      </Accordion>

      <Accordion
        {...section("group")}
        label={t("memory.review.group")}
        tip={t("lorebooks.entry.groupTip")}
        summary={e.group ? `${e.group}${e.groupWeight != null ? ` · ${e.groupWeight}` : ""}` : t("ui.mode.none")}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
          <Field label={t("lorebooks.entry.groupName")}>
            <Input value={e.group ?? ""} onInput={(ev) => set("group", ev.currentTarget.value)} />
          </Field>
          <Field label={t("lorebooks.entry.groupWeight")}>
            <Input
              className="text-right tabular-nums"
              inputMode="numeric"
              value={fmt(e.groupWeight)}
              placeholder="100"
              onInput={(ev) => set("groupWeight", numberOrNull(ev.currentTarget.value))}
            />
          </Field>
        </div>
      </Accordion>

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
    <div className="flex items-center gap-2 border-b border-edge px-3 py-2">
      <Chip pressed={e.enabled} onClick={() => set("enabled", !e.enabled)}>
        {t("lorebooks.entry.enabled")}
      </Chip>
      <input
        className={cn(
          "min-h-tap min-w-0 flex-1 rounded-sm border border-transparent bg-transparent px-2 font-prose text-title text-ink",
          "placeholder:text-dim hover:border-edge focus-visible:border-edge focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none",
        )}
        value={e.name}
        placeholder={t("lorebooks.entry.untitled")}
        aria-label={t("lorebooks.entry.nameLabel")}
        onInput={(ev) => set("name", ev.currentTarget.value)}
      />
      {e.locked && <span className="t-label t-label-s text-dim">{t("lorebooks.entry.locked")}</span>}
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

/** A labelled block of text with its counts and the full-screen editor. */
function TextBlock(props: {
  label: string;
  tip?: string;
  meta?: ReactNode;
  onExpand?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-h-tap-2 items-center gap-2">
        <span className={LABEL}>{props.label}</span>
        {props.tip && <HelpTip tip={props.tip} subject={props.label} />}
        {props.meta && <span className="ml-auto t-data text-data-s text-dim">{props.meta}</span>}
        {props.onExpand && (
          <Chip onClick={props.onExpand} title={t("lorebooks.record.editFullscreen")}>
            <Fullscreen size={ICON_SIZE.sm} stroke={2} aria-hidden />
            <span className="sr-only">{t("lorebooks.record.editFullscreen")}</span>
          </Chip>
        )}
      </div>
      {props.children}
    </div>
  );
}

/** A label and its help on the left, the control on the right. */
function SettingRow(props: { label: string; tip: string; children: ReactNode }) {
  return (
    <div className="flex min-h-tap flex-wrap items-center gap-2">
      <span className={LABEL}>{props.label}</span>
      <HelpTip tip={props.tip} subject={props.label} />
      <span className="ml-auto flex items-center gap-2">{props.children}</span>
    </div>
  );
}

function NumberInput(props: {
  label: string;
  value: number | null | undefined;
  placeholder: string;
  unit?: string;
  /** Room for a word placeholder such as "Blank = always". */
  wide?: boolean;
  onChange: (v: number | null) => void;
}) {
  return (
    <span className={cn("flex items-center gap-1", props.wide ? "w-44" : "w-24")}>
      <Input
        className="text-right tabular-nums"
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
    <div className="flex flex-wrap items-center gap-2">
      <span className={cn(LABEL, "w-32 shrink-0")}>{props.label}</span>
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
  );
}
