import { describe, expect, it } from "vitest";
import { DM_TOOLS, META_DM_TOOLS } from "./tools";

function toolNames(tools: typeof DM_TOOLS): string[] {
  return tools.filter((t) => t.type === "function").map((t) => t.function.name);
}

describe("META_DM_TOOLS", () => {
  it("only exposes log_plot_event — the meta DM can't touch game state", () => {
    expect(toolNames(META_DM_TOOLS)).toEqual(["log_plot_event"]);
  });

  it("is a strict subset of the full story DM_TOOLS", () => {
    const dmNames = new Set(toolNames(DM_TOOLS));
    for (const name of toolNames(META_DM_TOOLS)) {
      expect(dmNames.has(name)).toBe(true);
    }
    expect(DM_TOOLS.length).toBeGreaterThan(META_DM_TOOLS.length);
  });
});
