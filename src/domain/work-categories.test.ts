import { describe, expect, it } from "vitest";
import { allCategories, matchesCategoryFilter, parseWorkClassification, workCategories, workClassificationLabel } from "./work-categories";

const fixtures = [
  { id: "logo", category: "graphic-design", subcategory: "logo-branding" },
  { id: "brochure", category: "graphic-design", subcategory: "brochures" },
  { id: "storyboard", category: "video", subcategory: "video-storyboards" },
  { id: "existing", category: null, subcategory: null },
];

describe("category filtering", () => {
  it("includes existing uncategorized items when no filter is selected", () => {
    expect(fixtures.filter((item) => matchesCategoryFilter(item, allCategories))).toHaveLength(4);
  });
  it("narrows a category to one of its subcategories", () => {
    expect(fixtures.filter((item) => matchesCategoryFilter(item, { category: "graphic-design", subcategory: "all" })).map((item) => item.id)).toEqual(["logo", "brochure"]);
    expect(fixtures.filter((item) => matchesCategoryFilter(item, { category: "graphic-design", subcategory: "brochures" })).map((item) => item.id)).toEqual(["brochure"]);
  });
  it("keeps uncategorized items discoverable", () => {
    expect(fixtures.filter((item) => matchesCategoryFilter(item, { category: "uncategorized", subcategory: "all" })).map((item) => item.id)).toEqual(["existing"]);
    expect(workClassificationLabel(fixtures[3])).toBe("Uncategorized");
  });
  it("cannot include a subcategory from a different category", () => {
    expect(fixtures.filter((item) => matchesCategoryFilter(item, { category: "graphic-design", subcategory: "video-storyboards" }))).toEqual([]);
    expect(parseWorkClassification("graphic-design", "video-storyboards")).toBeNull();
  });
});

describe("work category choices", () => {
  it("accepts every supplied subcategory under its own category", () => {
    expect(workCategories.map((category) => category.label)).toEqual(["Graphic Design", "UI/UX", "Video", "Content Design"]);
    expect(workCategories.reduce((total, category) => total + category.subcategories.length, 0)).toBe(16);
    for (const category of workCategories) {
      for (const subcategory of category.subcategories) {
        expect(parseWorkClassification(category.id, subcategory.id)).toEqual({ category: category.id, subcategory: subcategory.id });
      }
    }
  });
  it("rejects missing or unknown category selections", () => {
    expect(parseWorkClassification("", "")).toBeNull();
    expect(parseWorkClassification("graphic-design", "")).toBeNull();
    expect(parseWorkClassification("unknown", "logo-branding")).toBeNull();
  });
  it("formats saved selections for cards and version details", () => {
    expect(workClassificationLabel(fixtures[0])).toBe("Graphic Design · Logo Branding");
  });
});
