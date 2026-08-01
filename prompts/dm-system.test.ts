import { describe, expect, it } from "vitest";
import { buildDmSystemPrompt, buildMetaSystemPrompt } from "./dm-system";

describe("buildDmSystemPrompt", () => {
  it("instructs the DM to call request_roll rather than narrate rolls itself", () => {
    const prompt = buildDmSystemPrompt();
    expect(prompt).toContain("request_roll");
    expect(prompt).toContain("apply_damage");
  });
});

describe("buildMetaSystemPrompt", () => {
  it("is a distinct, out-of-character prompt from the story prompt", () => {
    const meta = buildMetaSystemPrompt();
    const story = buildDmSystemPrompt();
    expect(meta).not.toBe(story);
  });

  it("tells the DM its only tool here is log_plot_event", () => {
    const meta = buildMetaSystemPrompt();
    expect(meta).toContain("log_plot_event");
  });

  it("does not grant mechanical tools like apply_damage or award_xp", () => {
    const meta = buildMetaSystemPrompt();
    expect(meta).not.toContain("apply_damage");
    expect(meta).not.toContain("award_xp");
  });
});
