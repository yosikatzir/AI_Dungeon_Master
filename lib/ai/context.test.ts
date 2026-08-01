import { describe, expect, it } from "vitest";
import {
  APPEARANCE_MAX_CHARS,
  BACKSTORY_MAX_CHARS,
  formatPresentCharacterLine,
  truncateForContext,
  type PresentCharacterInfo,
} from "./context";

function info(overrides: Partial<PresentCharacterInfo> = {}): PresentCharacterInfo {
  return {
    name: "Kara Ironhold",
    speciesName: "Human",
    className: "Fighter",
    backgroundName: "Soldier",
    level: 1,
    alignment: null,
    hpCurrent: 12,
    hpMax: 12,
    armorClass: 18,
    conditions: [],
    appearance: null,
    backstory: null,
    playedBy: "yosikatzir",
    ...overrides,
  };
}

describe("truncateForContext", () => {
  it("returns short text unchanged", () => {
    expect(truncateForContext("short", 300)).toBe("short");
  });

  it("ellipsizes text beyond the limit", () => {
    const text = "a".repeat(400);
    const result = truncateForContext(text, 300);
    expect(result.length).toBe(301);
    expect(result.endsWith("…")).toBe(true);
  });
});

describe("formatPresentCharacterLine", () => {
  it("includes species, class, background, level, and alignment in the identity clause", () => {
    const line = formatPresentCharacterLine(info({ alignment: "chaotic good" }));
    expect(line).toContain("Kara Ironhold (Human Fighter, Soldier background, level 1, chaotic good)");
  });

  it("omits the alignment clause when not set", () => {
    const line = formatPresentCharacterLine(info());
    expect(line).toContain("level 1) —");
    expect(line).not.toContain("null");
  });

  it("keeps HP/AC/conditions/played-by intact", () => {
    const line = formatPresentCharacterLine(
      info({ hpCurrent: 8, hpMax: 12, armorClass: 16, conditions: ["poisoned"], playedBy: "alex" }),
    );
    expect(line).toContain("HP 8/12, AC 16, conditions: poisoned. Played by alex.");
  });

  it("adds an Appearance line when appearance is set", () => {
    const line = formatPresentCharacterLine(
      info({ appearance: "A towering, scarred orc who ducks through doorways." }),
    );
    expect(line).toContain("Appearance: A towering, scarred orc who ducks through doorways.");
  });

  it("omits the Appearance line when appearance is empty/whitespace", () => {
    const line = formatPresentCharacterLine(info({ appearance: "   " }));
    expect(line).not.toContain("Appearance:");
  });

  it("truncates a long appearance to APPEARANCE_MAX_CHARS", () => {
    const long = "x".repeat(APPEARANCE_MAX_CHARS + 200);
    const line = formatPresentCharacterLine(info({ appearance: long }));
    const appearanceLine = line.split("\n").find((l) => l.includes("Appearance:"))!;
    // "  Appearance: " prefix + truncated text (max chars + ellipsis char)
    expect(appearanceLine.length).toBeLessThanOrEqual("  Appearance: ".length + APPEARANCE_MAX_CHARS + 1);
    expect(appearanceLine.endsWith("…")).toBe(true);
  });

  it("adds a Backstory line when backstory is set, truncated to BACKSTORY_MAX_CHARS", () => {
    const long = "y".repeat(BACKSTORY_MAX_CHARS + 200);
    const line = formatPresentCharacterLine(info({ backstory: long }));
    const backstoryLine = line.split("\n").find((l) => l.includes("Backstory:"))!;
    expect(backstoryLine).toBeDefined();
    expect(backstoryLine.endsWith("…")).toBe(true);
  });

  it("omits both Appearance and Backstory lines when neither is set", () => {
    const line = formatPresentCharacterLine(info());
    expect(line.split("\n")).toHaveLength(1);
  });
});
