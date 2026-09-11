import { describe, expect, it } from "vitest";
import { correctWriting, suggestWriting } from "./writing-correction";

describe("local writing correction", () => {
  it("corrects unambiguous dictionary spelling, grammar, punctuation, and capitalization", () => {
    expect(correctWriting("this are aplication.i can able to fix it").correctedText)
      .toBe("This is application. I can fix it");
  });

  it("preserves URLs exactly", () => {
    const url = "https://example.com/teh-file?q=dont#v1";
    expect(correctWriting(`open ${url}`).correctedText).toBe(`Open ${url}`);
  });

  it("generates dictionary suggestions without a hard-coded typo list", () => {
    expect(suggestWriting("appl")).toContain("apple");
    expect(suggestWriting("postar")).toContain("poster");
    expect(suggestWriting("applitacion")).toContain("application");
    expect(suggestWriting("teh")[0]).toBe("the");
  });

  it("does not guess when a misspelling has several equally close choices", () => {
    expect(correctWriting("uthradam postar").correctedText).toBe("Uthradam postar");
  });

  it("does not modify Malayalam text", () => {
    const source = "ഇത് പരിശോധിക്കുക";
    expect(correctWriting(source)).toEqual({ correctedText: source, changes: [], language: "Malayalam" });
  });
});
