import { describe, expect, it } from "vitest";
import { buildReferenceManifest, detectSubjectsInText, type ImageSubject } from "./images";

describe("buildReferenceManifest", () => {
  it("returns an empty string for no references", () => {
    expect(buildReferenceManifest([])).toBe("");
  });

  it("numbers references in order and ties each to its name", () => {
    const manifest = buildReferenceManifest(["Kara Ironhold", "Elenor"]);
    expect(manifest).toContain("Reference image 1 shows Kara Ironhold");
    expect(manifest).toContain("Reference image 2 shows Elenor");
    expect(manifest.indexOf("Kara Ironhold")).toBeLessThan(manifest.indexOf("Elenor"));
  });
});

describe("detectSubjectsInText", () => {
  const candidates: ImageSubject[] = [
    { name: "Kara", characterId: 1 },
    { name: "Elenor" },
    { name: "Al" },
  ];

  it("matches a candidate named in the text", () => {
    const result = detectSubjectsInText("A scene with Kara approaching the tavern.", candidates);
    expect(result.map((c) => c.name)).toEqual(["Kara"]);
  });

  it("matches multiple candidates in one string", () => {
    const result = detectSubjectsInText("Kara and Elenor talk in the market.", candidates);
    expect(result.map((c) => c.name).sort()).toEqual(["Elenor", "Kara"]);
  });

  it("is case-insensitive", () => {
    const result = detectSubjectsInText("kara walks in.", candidates);
    expect(result.map((c) => c.name)).toEqual(["Kara"]);
  });

  it("does not false-positive on a short name inside another word", () => {
    // "Al" should not match inside "Alistair" or "hall"
    const result = detectSubjectsInText("Alistair walks into the hall.", candidates);
    expect(result.map((c) => c.name)).toEqual([]);
  });

  it("returns no candidates when none are named", () => {
    const result = detectSubjectsInText("An empty room with dust motes.", candidates);
    expect(result).toEqual([]);
  });

  it("matches an informal first-name reference against a full punctuated name", () => {
    // Real bug: players type "Saulrok", not the full `Saulrok "Riff-Render" Wylde`.
    const nicknamed: ImageSubject[] = [{ name: 'Saulrok "Riff-Render" Wylde', characterId: 3 }];
    const result = detectSubjectsInText("saulrok talking to the barkeep", nicknamed);
    expect(result.map((c) => c.name)).toEqual(['Saulrok "Riff-Render" Wylde']);
  });

  it("matches on the quoted nickname alone too", () => {
    const nicknamed: ImageSubject[] = [{ name: 'Saulrok "Riff-Render" Wylde', characterId: 3 }];
    const result = detectSubjectsInText("Riff-Render steps up to the bar.", nicknamed);
    expect(result.map((c) => c.name)).toEqual(['Saulrok "Riff-Render" Wylde']);
  });
});
