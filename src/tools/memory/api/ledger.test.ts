// Read through the endpoint rather than against the schema directly.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchLedger } from "./ledger";
import { readConsoleState } from "../../../shell/state";

vi.mock("../../../shell/state", () => ({ readConsoleState: vi.fn(), writeConsoleState: vi.fn() }));
vi.mock("../../../shell/toast", () => ({ toast: vi.fn() }));

const stored = vi.mocked(readConsoleState);
const answers = (value: unknown) => stored.mockResolvedValue(value as never);

const record = () => ({
  dec: { "draft-1:a4ee5529": "keep", "draft-1:2f215c62": "drop" },
  edited: {},
  savedAt: "2026-08-25T08:54:36.984Z",
});

describe("fetchLedger", () => {
  beforeEach(() => { stored.mockReset(); });

  it("reads back the ledger this console wrote", async () => {
    answers(record());
    expect((await fetchLedger()).dec).toEqual(record().dec);
  });

  it("accepts the empty document a key nothing has written returns", async () => {
    answers({});
    expect(await fetchLedger()).toEqual({});
  });

  it("rejects a decision that is neither keep nor drop", async () => {
    answers({ ...record(), dec: { "draft-1:a4ee5529": "maybe" } });
    await expect(fetchLedger()).rejects.toThrow();
  });

  it("rejects an edited claim that is not a mutation", async () => {
    answers({ ...record(), edited: { "draft-1:a4ee5529": { id: "a4ee5529" } } });
    await expect(fetchLedger()).rejects.toThrow();
  });

  it("rejects a stamp sent as anything but a string", async () => {
    answers({ ...record(), savedAt: 1756111676984 });
    await expect(fetchLedger()).rejects.toThrow();
  });
});
