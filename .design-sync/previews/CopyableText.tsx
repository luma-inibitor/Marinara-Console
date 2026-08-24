import { CopyableText } from "marinara-console";

export function Identifier() {
  return (
    <div style={{ maxWidth: 420 }}>
      <CopyableText value="char_devi_okonkwo" label="note id" />
    </div>
  );
}

export function Hash() {
  return (
    <div style={{ width: 240, padding: "var(--s2) var(--s3)",
                  background: "var(--surface-2)", border: "var(--hairline)",
                  borderRadius: "var(--r-s)" }}>
      <CopyableText
        value="source_character_c7a1843d96ae1092"
        label="source id"
      />
      <div style={{ marginTop: "var(--s2)" }}>
        <CopyableText
          value="9f2c1ad4e37b58c0a61d4f8e2b93760c5d1e8a47f0b2c96d3e75a18b4c0f2d69"
          label="content hash"
        />
      </div>
    </div>
  );
}

export function Field() {
  return (
    <div style={{ display: "grid", gap: "var(--s1)", maxWidth: 420 }}>
      <span className="t-label t-label-s">Extracted from chat</span>
      <CopyableText value="chat_2f8b41c9-harbour-writ" label="chat id" />
    </div>
  );
}
