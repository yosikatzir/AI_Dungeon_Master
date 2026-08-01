import { describe, expect, it } from "vitest";
import { pickBestReferenceImages } from "./images";
import type { RegisteredImage } from "./images";

function image(overrides: Partial<RegisteredImage>): RegisteredImage {
  return {
    id: 1,
    campaignId: null,
    kind: "scene",
    subjectTags: [],
    prompt: "",
    filePath: "x.png",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("pickBestReferenceImages", () => {
  it("prefers an uploaded portrait over any campaign-scoped image", () => {
    const portraits = [image({ id: 1, kind: "portrait", subjectTags: ["kara"], filePath: "portrait.png" })];
    const campaignImages = [image({ id: 2, kind: "scene", subjectTags: ["kara"], filePath: "scene.png" })];
    const result = pickBestReferenceImages(["Kara"], portraits, campaignImages);
    expect(result.get("Kara")?.filePath).toBe("portrait.png");
  });

  it("falls back to the newest campaign image when there's no portrait", () => {
    const campaignImages = [
      image({ id: 3, subjectTags: ["elenor"], filePath: "newer.png" }),
      image({ id: 2, subjectTags: ["elenor"], filePath: "older.png" }),
    ];
    const result = pickBestReferenceImages(["Elenor"], [], campaignImages);
    expect(result.get("Elenor")?.filePath).toBe("newer.png");
  });

  it("is case-insensitive when matching tags", () => {
    const portraits = [image({ subjectTags: ["grosh skullcrusher"], filePath: "portrait.png" })];
    const result = pickBestReferenceImages(["Grosh Skullcrusher"], portraits, []);
    expect(result.get("Grosh Skullcrusher")?.filePath).toBe("portrait.png");
  });

  it("omits a tag with no matching reference at all", () => {
    const result = pickBestReferenceImages(["Nobody"], [], []);
    expect(result.has("Nobody")).toBe(false);
  });

  it("resolves each tag independently across multiple subjects", () => {
    const portraits = [image({ subjectTags: ["kara"], filePath: "kara-portrait.png" })];
    const campaignImages = [image({ subjectTags: ["elenor"], filePath: "elenor-scene.png" })];
    const result = pickBestReferenceImages(["Kara", "Elenor", "Nobody"], portraits, campaignImages);
    expect(result.get("Kara")?.filePath).toBe("kara-portrait.png");
    expect(result.get("Elenor")?.filePath).toBe("elenor-scene.png");
    expect(result.has("Nobody")).toBe(false);
  });
});
