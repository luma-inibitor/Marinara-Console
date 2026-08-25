// Copy is stubbed to the catalog key, so a reword is not a test failure.
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../copy", () => ({ tAny: (key: string) => key }));

import { section } from "../test/factories";
import { isMarker, markerLabel } from "./marker";

describe("isMarker", () => {
  it("needs both the flag and a config", () => {
    expect(isMarker(section({ isMarker: true, markerConfig: { type: "lorebook" } }))).toBe(true);
    expect(isMarker(section({ isMarker: true, markerConfig: null }))).toBe(false);
    expect(isMarker(section({ isMarker: false, markerConfig: { type: "lorebook" } }))).toBe(false);
  });

  it("never infers from content, so an empty new section is not one", () => {
    expect(isMarker(section({ content: "" }))).toBe(false);
  });
});

describe("markerLabel", () => {
  it("names a mapped type through the catalog", () => {
    expect(markerLabel(section({ isMarker: true, markerConfig: { type: "chat_history" } })))
      .toBe("presets.marker.chat_history");
  });

  it("falls through to the raw identifier for a type the assembler added later", () => {
    expect(markerLabel(section({ isMarker: true, markerConfig: { type: "custom_thing" } })))
      .toBe("custom_thing");
  });

  it("says nothing about a section that is not a marker", () => {
    expect(markerLabel(section())).toBe(null);
  });
});
