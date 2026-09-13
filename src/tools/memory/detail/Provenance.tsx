import { useId } from "react";
import { t } from "../../../copy";
import type { Note } from "../api/types";
import { CopyableText, ModePill } from "../../../ui";
import { After, DL, Pair, Word } from "./chrome";
import { ScopeList } from "./RetrievalCard";

type Provenance = NonNullable<Note["provenance"]>;

function ProvenanceLine({ p }: { p: Provenance }) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-[6px] [overflow-wrap:anywhere]">
      <span>{p.kind}</span>
      {p.sourceId && (
        <After>
          <span>{p.sourceId}</span>
        </After>
      )}
      {p.entryId && (
        <After>
          <span>{p.entryId}</span>
        </After>
      )}
    </span>
  );
}

/** Where a source note came from. */
export function Provenance({ note }: { note: Note }) {
  const headingId = useId();
  const p = note.provenance;
  const f = note.extractionFingerprint;
  if (!p && !f) return null;
  return (
    <section aria-labelledby={headingId} className="mt-3">
      <h2 id={headingId} className="m-0 mb-[6px] t-label t-label-s">
        {t("memoryvault.provenance")}
      </h2>
      {p && (
        <dl className={DL}>
          <Pair k="kind">{p.kind}</Pair>
          {p.sourceId && (
            <Pair k="sourceId">
              <CopyableText value={p.sourceId} />
            </Pair>
          )}
          {p.entryId && (
            <Pair k="entryId">
              <CopyableText value={p.entryId} />
            </Pair>
          )}
        </dl>
      )}
      {f && (
        <>
          <h3 className="m-0 mt-2 mb-[6px] t-label t-label-s">{t("memory.detail.fingerprint")}</h3>
          <dl className={DL}>
            {f.version != null && <Pair k="version">{f.version}</Pair>}
            {f.sourceHash && (
              <Pair k="sourceHash">
                <CopyableText value={f.sourceHash} />
              </Pair>
            )}
            {f.extractionMode && <Pair k="extractionMode">{f.extractionMode}</Pair>}
            {f.modes && (
              <Pair k={<Word>{t("memory.detail.modes")}</Word>}>
                <span className="inline-flex min-w-0">
                  <ModePill modes={f.modes} />
                </span>
              </Pair>
            )}
            <Pair k={<Word>{t("memoryvault.scope")}</Word>} top>
              <ScopeList scope={f.scope} />
            </Pair>
            <Pair k={<Word>{t("memoryvault.provenance")}</Word>} top>
              {f.provenance ? <ProvenanceLine p={f.provenance} /> : <span className="text-dim">—</span>}
            </Pair>
          </dl>
        </>
      )}
    </section>
  );
}
