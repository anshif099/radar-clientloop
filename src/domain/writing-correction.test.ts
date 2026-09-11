import { describe, expect, it } from "vitest";
import { correctWriting } from "./writing-correction";

describe("local writing correction", () => {
  it("corrects known spelling, grammar, punctuation, and capitalization", () => {
    expect(correctWriting("this are teh currection.i can able to fix it").correctedText)
      .toBe("This is the correction. I can fix it");
  });

  it("preserves URLs exactly", () => {
    const url = "https://example.com/teh-file?q=dont#v1";
    expect(correctWriting(`plase open ${url}`).correctedText).toBe(`Please open ${url}`);
  });

  it("corrects application misspellings instead of only capitalizing them", () => {
    expect(correctWriting("applitacion").correctedText).toBe("Application");
    expect(correctWriting("aplication form").correctedText).toBe("Application form");
  });

  it("does not modify Malayalam text", () => {
    const source = "ഇത് പരിശോധിക്കുക";
    expect(correctWriting(source)).toEqual({ correctedText: source, changes: [], language: "Malayalam" });
  });
});
