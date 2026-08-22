// Sources — import and extract (ltm-review J2). Three source kinds, each with
// its own reason for a zero; freshness in the product's vocabulary; import
// runs with extraction and reports what was kept and what was lost, with the
// next step (Open Review Queue) one tap away.

import { useEffect, useState } from "preact/hooks";
import { navigate } from "../../shell/router";
import { api } from "../../shell/api";
import { toast } from "../../shell/toast";
import { type ImportPreview, type ImportResult, importPreview, importSourceNotes } from "./data";
import { t } from "./strings";
import { focusSource, refreshLtmStatus } from "./MemoryTool";
import { DecisionIcon } from "./icons";

const KINDS = [
  { source: "characters", label: () => t("sourcesworkspace.characters"), emptyWhy: () => t("memoryvault.noMatchingCharacters") },
  { source: "lorebooks", label: () => t("sourcesworkspace.lorebooks"), emptyWhy: () => t("sourcesworkspace.noLorebooksAreAvailableInThisScope") },
  { source: "chats", label: () => t("sourcesworkspace.chatSummaries"), emptyWhy: () => t("longtermmemorydetail.sourceChatDescription") },
];

interface Chat { id: string; name?: string; mode?: string }

function freshnessLabel(freshness: string): string {
  switch (freshness) {
    case "new": return t("sourcesworkspace.new");
    case "current": return t("sourcesworkspace.alreadyImported");
    case "source_updated": return t("sourcesworkspace.updateAvailable");
    case "context_updated": return t("sourcesworkspace.contextChanged");
    case "extraction_incomplete": return t("sourcesworkspace.extractionIncomplete");
    default: return freshness;
  }
}

export function Sources() {
  const [previews, setPreviews] = useState<Map<string, ImportPreview | { error: string }>>(new Map());
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatId, setChatId] = useState(localStorage.getItem("mc-ltm-chat") ?? "");
  const [selected, setSelected] = useState<Map<string, Set<string>>>(new Map());
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<Array<ImportResult | { source: string; error: string }>>([]);

  const loadPreviews = async () => {
    const next = new Map<string, ImportPreview | { error: string }>();
    await Promise.all(KINDS.map(async ({ source }) => {
      try { next.set(source, await importPreview(source)); }
      catch (error) { next.set(source, { error: (error as Error).message }); }
    }));
    setPreviews(next);
  };

  useEffect(() => {
    void loadPreviews();
    api<Chat[] | { items: Chat[] }>("/chats")
      .then((r) => setChats(Array.isArray(r) ? r : r.items ?? []))
      .catch(() => setChats([]));
  }, []);

  const totalSelected = [...selected.values()].reduce((n, s) => n + s.size, 0);

  const toggle = (source: string, id: string) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(source) ?? []);
      set.has(id) ? set.delete(id) : set.add(id);
      next.set(source, set);
      return next;
    });
  };

  const [importStep, setImportStep] = useState("");
  const runImport = async () => {
    setImporting(true);
    setResults([]);
    const batches = [...selected.entries()].filter(([, set]) => set.size);
    const total = batches.reduce((n, [, set]) => n + set.size, 0);
    let done = 0;
    // One request per source so results stream in and progress is real —
    // each import is a model call and can take a while.
    for (const [source, set] of batches) {
      for (const id of set) {
        done += 1;
        setImportStep(`${done}/${total}`);
        try {
          const body: Record<string, unknown> = { source, sourceIds: [id], extract: true };
          if (chatId) body.chatId = chatId;
          const res = await importSourceNotes(body);
          setResults((prev) => [...prev, res]);
        } catch (error) {
          setResults((prev) => [...prev, { source, error: (error as Error).message }]);
        }
      }
    }
    setImportStep("");
    setSelected(new Map());
    setImporting(false);
    await loadPreviews();
    void refreshLtmStatus();
  };

  return (
    <div class="audit"><div class="audit-list">
      <header class="console">
        <div class="probe">
          <label class="t-label t-label-s scope-label" for="chat-scope">{t("sourcesworkspace.importScope")}</label>
          <div class="pwrap">
            <select id="chat-scope" class="t-data scope-sel" value={chatId}
              onChange={(e) => { setChatId(e.currentTarget.value); localStorage.setItem("mc-ltm-chat", e.currentTarget.value); }}>
              <option value="">{t("sourcesworkspace.allChats")}</option>
              {chats.map((c) => <option key={c.id} value={c.id}>{c.name ?? c.id}{c.mode ? ` · ${c.mode}` : ""}</option>)}
            </select>
          </div>
        </div>
        <p class="t-prose dim scope-hint">{t("sourcesworkspace.limitImportsToThisChatAndItsRelatedScope")}</p>
      </header>

      <main class="rows mem-rows">
        {results.map((res, i) => "error" in res
          ? <div key={i} class="mem-card is-danger"><span class="fl">error</span> <span class="t-prose">{res.error}</span></div>
          : <ImportResultCard key={i} result={res} />)}

        {KINDS.map(({ source, label, emptyWhy }) => {
          const preview = previews.get(source);
          if (!preview) {
            return (
              <div key={source}>
                <div class="grouphead"><span class="gn t-prose">{label()}</span>
                  <span class="t-data dim">scanning…</span></div>
              </div>
            );
          }
          if ("error" in preview) {
            return <div key={source} class="mem-card is-danger"><b class="t-prose">{label()}</b><p class="t-data dim">{preview.error}</p></div>;
          }
          const sel = selected.get(source) ?? new Set<string>();
          return (
            <div key={source}>
              <div class="grouphead">
                <span class="gn t-prose">{label()}</span>
                <span class="t-data dim">{preview.scanned} scanned · {preview.draftable} {t("sourcesworkspace.readyToImport").toLowerCase()}</span>
              </div>
              {preview.samples.length === 0 && <p class="t-prose dim empty-why">{emptyWhy()}</p>}
              {preview.samples.map((s) => (
                <div key={s.sourceId} class="row mem-row" data-d={sel.has(s.sourceId) ? "keep" : "undecided"}>
                  <div class="row-summary mem-summary">
                    <button class="rail-cell tri hit" aria-label={`Select ${s.title}`} onClick={() => toggle(source, s.sourceId)}>
                      <DecisionIcon d={sel.has(s.sourceId) ? "keep" : null} />
                    </button>
                    <button class="mid mem-mid" onClick={() => toggle(source, s.sourceId)}>
                      <span class="nm">{s.title}</span>
                      <span class="metaline t-data">
                        <span class={s.freshness === "new" ? "is-keep" : s.freshness === "current" ? "dim" : "fl"}>{freshnessLabel(s.freshness)}</span>
                        <i class="sep" data-contrast-exempt>·</i>{t("sourcesworkspace.importsAsMode", { mode: s.importMode })}
                      </span>
                      <span class="t-prose dim snippet">{s.snippet}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </main>

      {totalSelected > 0 && (
        <div class="apply-dock">
          <span class="dock-info t-data">{totalSelected} selected</span>
          <button class="dock-primary t-label" disabled={importing} onClick={() => void runImport()}>
            {importing ? `Importing ${importStep}…` : t("sourcesworkspace.importSelected_7fb57e8")}
          </button>
        </div>
      )}
    </div></div>
  );
}

function ImportResultCard({ result }: { result: ImportResult }) {
  return (
    <div class="mem-card">
      <div class="t-data">
        <span class={result.batchStatus === "success" ? "is-keep" : "fl"}>{result.batchStatus.replaceAll("_", " ")}</span>
        {" "}<b>{result.imported.length}</b> {t("sourcesworkspace.imported")}
      </div>
      {result.imported.map((item) => {
        const a = item.draft?.accounting;
        const candidates = a ? a.providerCandidates + a.normalizedAdditions : 0;
        const sourceNoteId = item.note?.id ?? item.draft?.source?.sourceNoteId;
        return (
          <div key={item.sourceId} class="import-item">
            <div class="t-prose">{item.title}</div>
            <div class="t-data dim">
              {a ? t("sourcesworkspace.suggestionsKeptOfTotal", { kept: a.keptUnits, total: candidates }) : t("sourcesworkspace.statusNoSuggestionsCreated")}
              {a && candidates - a.keptUnits > 0 && ` · ${t("sourcesworkspace.rejectedSuggestionCount", { count: candidates - a.keptUnits })}`}
            </div>
            {Boolean(item.draft?.mutations?.length) && sourceNoteId && (
              <button class="chip" onClick={() => { focusSource(sourceNoteId); navigate("memory/review"); }}>
                {t("longtermmemorydetail.openReviewQueue")}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
