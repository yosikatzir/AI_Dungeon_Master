import { describe, expect, it } from "vitest";
import { parseComposedPrompt } from "./scenePrompt";

describe("parseComposedPrompt", () => {
  it("parses a well-formed response", () => {
    const result = parseComposedPrompt(
      '{"description": "A cramped ship hull, lantern swinging.", "characters": ["Saulrok", "Bilge Rat"]}',
    );
    expect(result).toEqual({
      description: "A cramped ship hull, lantern swinging.",
      characters: ["Saulrok", "Bilge Rat"],
    });
  });

  it("trims whitespace from the description and names", () => {
    const result = parseComposedPrompt('{"description": "  A dark hold.  ", "characters": ["  Saulrok "]}');
    expect(result).toEqual({ description: "A dark hold.", characters: ["Saulrok"] });
  });

  it("accepts an empty character list (an unpeopled scene is legitimate)", () => {
    const result = parseComposedPrompt('{"description": "An empty deck at dawn.", "characters": []}');
    expect(result).toEqual({ description: "An empty deck at dawn.", characters: [] });
  });

  it("defaults characters to an empty list when the key is missing entirely", () => {
    const result = parseComposedPrompt('{"description": "A storm over the water."}');
    expect(result).toEqual({ description: "A storm over the water.", characters: [] });
  });

  it("drops non-string and blank entries from the character list", () => {
    const result = parseComposedPrompt(
      '{"description": "A brawl.", "characters": ["Saulrok", 7, "", "   ", null]}',
    );
    expect(result?.characters).toEqual(["Saulrok"]);
  });

  it("returns null for malformed JSON", () => {
    expect(parseComposedPrompt("{not json")).toBeNull();
  });

  it("returns null when the description is missing or empty", () => {
    expect(parseComposedPrompt('{"characters": ["Saulrok"]}')).toBeNull();
    expect(parseComposedPrompt('{"description": "   ", "characters": []}')).toBeNull();
  });

  it("returns null for a non-object payload", () => {
    expect(parseComposedPrompt('"just a string"')).toBeNull();
    expect(parseComposedPrompt("null")).toBeNull();
  });
});
