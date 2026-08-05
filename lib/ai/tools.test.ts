import { describe, expect, it } from "vitest";
import { DM_TOOLS, META_DM_TOOLS } from "./tools";

function toolNames(tools: typeof DM_TOOLS): string[] {
  return tools.map((t) => t.toolSpec?.name).filter((name): name is string => Boolean(name));
}

describe("DM_TOOLS", () => {
  it("exposes the NPC ground-truth tools the dice rules depend on", () => {
    const names = new Set(toolNames(DM_TOOLS));
    for (const name of ["roll_npc", "damage_npc", "heal_npc", "update_npc", "request_roll"]) {
      expect(names.has(name)).toBe(true);
    }
  });

  it("lists real monster ids in update_npc's schema so the DM can't invent one", () => {
    const updateNpc = DM_TOOLS.find((t) => t.toolSpec?.name === "update_npc");
    const schema = updateNpc?.toolSpec?.inputSchema as { json: { properties: Record<string, { description?: string }> } };
    expect(schema.json.properties.monsterId.description).toContain("goblin");
  });

  it("tells the DM to set a DC on request_roll", () => {
    const requestRoll = DM_TOOLS.find((t) => t.toolSpec?.name === "request_roll");
    const schema = requestRoll?.toolSpec?.inputSchema as { json: { properties: Record<string, { description?: string }> } };
    expect(schema.json.properties.dc.description).toMatch(/passive Perception/i);
  });
});

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
