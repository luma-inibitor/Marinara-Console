// What Apply will send — the sheet behind the dock's tally.
//
// The dock can state figures; it has no room to explain them, and it was
// trying to. Everything that needs room moved here.
//
// The sheet answers one question — *can I press Apply, or is there something
// here I have to deal with first* — so it is built as an answer and not as a
// ledger (CHECKLIST §1). One outcome figure leads. Under it sit only the
// things the reviewer did not ask for, and under those, the quiet remainder.
//
// An earlier pass led with the exception list and closed with a three-row
// block of right-aligned figures: decided / will be applied / ready. That
// block was the defect. Right-aligning three numbers in a mono column
// promises they are comparable, and they were three different units — claims,
// drafts, memory writes — so 8 → 2 → 9 read as arithmetic that had gone
// wrong. It also restated the dock's own keep/drop tally, which the reviewer
// had just tapped (CHECKLIST §3).
//
// What replaces it: the send count alone, in its unit. The reason it exceeds
// what the reviewer kept is the dependency section directly beneath, so the
// figure needs no gloss of its own — one was drafted and cut, because it said
// the same fact the section heading was already saying (CHECKLIST §2). The
// drafts figure is gone from the top entirely: how many extraction batches
// Apply contacts is plumbing, and it was carrying the weight of an outcome.

import { t } from "../../../copy";
import { Sheet, SheetHead } from "../../../ui/Sheet";
import { Flag, Failure, Download, ICON_SIZE } from "../../../ui/icons";
import { TypeIcon } from "../icons";
import type { Row } from "../model/review";
import { backupExportUrl } from "../store/backup";
import "./DockSheet.css";

interface DockSheetModel {
  undecided: number;
  edited: number;
  /** Drafts that survive Apply because they still hold undecided claims. */
  stayPending: number;
  /** Mutations the engine reports it will write, after drops. Null while the
   *  preflight has not answered — unknown is not zero. */
  ready: number | null;
  /** Rows preflight pulled in that the reviewer never decided. These are the
   *  ones that will actually be written on top of the keeps. */
  auto: Row[];
  /** Rows preflight pulled in that the reviewer explicitly dropped. Apply
   *  strips these before sending (model/tally.ts countReadyToSend), so they
   *  are not "added" — they are a conflict between the ledger and the engine,
   *  and listing them beside the additions said something false. */
  droppedRequired: Row[];
  /** Rows preflight refused, with its reason. */
  held: Array<{ row: Row; why: string }>;
  /** Kept claims whose dropped dependency will make them fail. */
  warnings: number;
  offerRestore: boolean;
}

export function DockSheet(props: { model: DockSheetModel; onClose: () => void; onRestore: () => void }) {
  const m = props.model;
  const checking = m.ready === null;
  return (
    <Sheet label={t("memory.dock.detailTitle")} onClose={props.onClose} className="dock-sheet">
      <SheetHead title={<span className="t-label t-label-s">{t("memory.dock.detailTitle")}</span>} />

      <div className="ds-body">
        {/* ── the outcome ──
            The sheet's title is this figure's label, so it carries none of
            its own; a second label would name the same thing twice. */}
        <div className="ds-out">
          <p className={`ds-out-v t-data ${checking ? "is-pending" : ""}`}>
            {checking ? t("memory.dock.checking") : t("memory.dock.unitMutations", { count: m.ready! })}
          </p>
        </div>

        {/* ── what the reviewer did not ask for ──
            Failures and omissions first, additions last: the order is how
            badly each one wants a decision changed. */}
        {m.warnings > 0 && (
          <Section tone="danger" icon={<Failure size={ICON_SIZE.sm} stroke={1.75} aria-hidden />}
            title={t("memory.dock.willFail", { count: m.warnings })}
            why={t("memory.dock.willFailWhy", { count: m.warnings })} />
        )}

        {m.held.length > 0 && (
          <Section tone="danger" icon={<Failure size={ICON_SIZE.sm} stroke={1.75} aria-hidden />}
            title={t("memory.dock.blocked", { count: m.held.length })}
            why={t("memory.dock.blockedWhy", { count: m.held.length })}>
            {m.held.map(({ row, why }) => <ClaimLine key={row.key} row={row} why={why} />)}
          </Section>
        )}

        {m.droppedRequired.length > 0 && (
          <Section tone="danger" icon={<Failure size={ICON_SIZE.sm} stroke={1.75} aria-hidden />}
            title={t("memory.dock.droppedRequired", { count: m.droppedRequired.length })}
            why={t("memory.dock.droppedRequiredWhy", { count: m.droppedRequired.length })}>
            {m.droppedRequired.map((row) => <ClaimLine key={row.key} row={row} />)}
          </Section>
        )}

        {/* No `why` — "added as dependencies" is already the reason, and it is
            also the reason the outcome above exceeds what the reviewer kept.
            An explanatory line here would say that fact a second time. */}
        {m.auto.length > 0 && (
          <Section tone="flag" icon={<Flag size={ICON_SIZE.sm} stroke={1.75} aria-hidden />}
            title={t("memory.autoIncluded", { count: m.auto.length })}>
            {m.auto.map((row) => <ClaimLine key={row.key} row={row} />)}
          </Section>
        )}

        {/* ── the remainder ──
            Plain sentences, not figures. Each one is a fact about the queue
            after Apply rather than a quantity to compare with the outcome,
            which is why none of them are set as a value in a column. */}
        <ul className="ds-rest t-data">
          {m.undecided > 0 && <li>{t("memory.dock.stillUndecided", { count: m.undecided })}</li>}
          {m.stayPending > 0 && <li>{t("memory.dock.draftsStayOpen", { count: m.stayPending })}</li>}
          {m.edited > 0 && <li>{t("memory.dock.editedStaged", { count: m.edited })}</li>}
        </ul>

        {m.offerRestore && (
          <a className="ds-restore t-label t-label-s" href={backupExportUrl()} download onClick={props.onRestore}>
            <Download size={ICON_SIZE.sm} stroke={1.75} aria-hidden />
            {t("memory.restorePoint")}
          </a>
        )}
      </div>
    </Sheet>
  );
}

/** A heading that counts, and a sentence that says what becomes of them.
 *
 *  The two are separate because the faces are: a heading is structure and gets
 *  the label face in caps, a consequence is something a person reads and gets
 *  prose (DESIGN.md §1). Carrying both in one string forced sentences —
 *  "1 blocked — held back from Apply" — through the caps treatment, where they
 *  wrapped to two lines of tracked upper-case red. */
function Section(props: {
  tone: "flag" | "danger";
  icon: React.ReactNode;
  title: string;
  why?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className={`ds-sec is-${props.tone}`}>
      <h3 className="ds-sec-h t-label t-label-s">
        <span className="ds-sec-i">{props.icon}</span>
        {props.title}
      </h3>
      {props.why && <p className="ds-sec-w t-prose">{props.why}</p>}
      {props.children}
    </section>
  );
}

/** One claim, in the queue's own row vocabulary: the target chip (`.a1-tgt`)
 *  over the claim (`.claim-text`), same faces, sizes and hues as the list.
 *  Both classes are reused rather than re-declared so a change to the row
 *  reaches this surface too; the sheet only relaxes the two properties the
 *  list needs and it does not — the target's 34% cap and the claim's single
 *  line. Wrapping is the reason this sheet exists. */
function ClaimLine(props: { row: Row; why?: string }) {
  const r = props.row;
  return (
    <div className="ds-claim">
      <span className="a1-tgt t-data">
        <TypeIcon type={r.targetType} size={13} />
        {r.targetTitle}
      </span>
      <span className="claim-text t-prose">{r.text}</span>
      {props.why && <span className="ds-claim-w t-data">{props.why}</span>}
    </div>
  );
}
