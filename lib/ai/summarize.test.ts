import { describe, expect, it, vi } from "vitest";
import type { NpcRosterEntry } from "@/lib/npcs";

// summarize.ts pulls in the Bedrock client and the DB at import time; neither
// is needed to exercise the roster merge.
vi.mock("@/lib/ai/bedrock", () => ({ bedrock: {}, withRetry: (fn: () => unknown) => fn() }));
vi.mock("@/lib/campaigns", () => ({
  getCampaign: () => null,
  listMessagesAfter: () => [],
  updateCampaignMemory: () => {},
}));

const { mergeRosterPreservingStats } = await import("./summarize");

const stats = {
  ac: 15,
  hpMax: 7,
  hpCurrent: 3,
  abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
  skills: { stealth: 6 },
  savingThrows: {},
};

const existing: NpcRosterEntry[] = [
  { name: "Grimtooth", description: "A goblin.", disposition: "hostile", stats },
  { name: "Barkeep", description: "Friendly.", disposition: "warm" },
];

describe("mergeRosterPreservingStats", () => {
  it("carries stats over onto the summarizer's rewritten entry", () => {
    // The summarizer never sees stat blocks and cannot return them — without
    // the merge, this pass would strip a wounded monster back to no numbers.
    const incoming: NpcRosterEntry[] = [
      { name: "Grimtooth", description: "A goblin, now nursing a wound.", disposition: "furious" },
    ];
    const merged = mergeRosterPreservingStats(existing, incoming);
    expect(merged).toHaveLength(1);
    expect(merged[0].description).toBe("A goblin, now nursing a wound.");
    expect(merged[0].disposition).toBe("furious");
    expect(merged[0].stats?.hpCurrent).toBe(3);
    expect(merged[0].stats?.ac).toBe(15);
  });

  it("matches names case-insensitively", () => {
    const merged = mergeRosterPreservingStats(existing, [
      { name: "grimtooth", description: "x", disposition: "y" },
    ]);
    expect(merged[0].stats?.hpCurrent).toBe(3);
  });

  it("leaves a genuinely new NPC unstatted", () => {
    const merged = mergeRosterPreservingStats(existing, [
      { name: "Sea Captain", description: "New face.", disposition: "wary" },
    ]);
    expect(merged[0].stats).toBeUndefined();
  });

  it("keeps the existing roster when the summarizer returns nothing", () => {
    expect(mergeRosterPreservingStats(existing, undefined)).toBe(existing);
    expect(mergeRosterPreservingStats(existing, [])).toBe(existing);
  });

  it("drops NPCs the summarizer pruned, stats and all", () => {
    const merged = mergeRosterPreservingStats(existing, [
      { name: "Barkeep", description: "Friendly.", disposition: "warm" },
    ]);
    expect(merged.map((n) => n.name)).toEqual(["Barkeep"]);
  });
});
