import { useId } from "react";
import { t } from "../../../copy";
import type { Note } from "../api/types";
import { After } from "./chrome";

/** The identities a character or relationship memory describes. */
export function Subjects({ subjects }: { subjects: Note["subjects"] }) {
  const headingId = useId();
  if (!subjects?.length) return null;
  return (
    <section aria-labelledby={headingId} className="mt-3">
      <h2 id={headingId} className="m-0 mb-[6px] t-label t-label-s">
        {t("memoryvault.subjects")}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-1 p-0 font-data text-data-s">
        {subjects.map((s) => (
          <li key={s.key} className="flex min-w-0 flex-wrap items-baseline gap-x-[6px]">
            <span className="[overflow-wrap:anywhere] text-ink">{s.key}</span>
            {s.ref && (
              <After>
                <span className="[overflow-wrap:anywhere] text-dim">
                  {s.ref.kind}
                  {s.ref.kind && s.ref.id && " "}
                  {s.ref.id}
                </span>
              </After>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
