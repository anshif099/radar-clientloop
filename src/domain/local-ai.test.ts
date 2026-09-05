import { describe, expect, it } from "vitest";
import { checkRevisionRequirements, interpretQuestion } from "./local-ai";

describe("locally interpreted questions", () => {
  it.each(["How many posts are pending?", "Count unapproved posters"])("understands status counts: %s", (question) => {
    expect(interpretQuestion(question)).toMatchObject({ kind: "summary", status: "AWAITING_CLIENT_REVIEW" });
  });
  it("keeps status and time filters when listing posts", () => {
    expect(interpretQuestion("Show approved posts this month", new Date("2026-09-05T12:00:00Z"))).toMatchObject({ kind: "search", status: "APPROVED", query: "", since: new Date("2026-09-01T00:00:00Z") });
  });
  it("understands conversational requests for changes", () => {
    expect(interpretQuestion("Which posts need changes?")).toMatchObject({ kind: "search", status: "REVISION_REQUIRED", query: "" });
  });
  it("distinguishes rejection from requested revisions", () => {
    expect(interpretQuestion("Show rejected posts").reviewDecision).toBe("REJECT");
    expect(interpretQuestion("Which posts need changes?").reviewDecision).toBe("REQUEST_CHANGES");
  });
  it("preserves quoted search terms including SQL metacharacters as data", () => {
    expect(interpretQuestion('Find posts about "summer_%"')).toMatchObject({ kind: "search", query: "summer_%" });
  });
  it.each(["Analyze v2", "Is this version perfect?", "Check if anything is missing"])("recognizes revision follow-ups: %s", (question) => {
    expect(interpretQuestion(question).kind).toBe("review");
  });
});
describe("evidence-based revision checks", () => {
  it("flags wrong dimensions as missing", () => {
    expect(checkRevisionRequirements(["Please resize to 1080 x 1080 pixels"], { width: 900, height: 900 })[0].result).toBe("missing");
  });
  it("verifies a purely measurable requirement", () => {
    expect(checkRevisionRequirements(["Please resize to 1080 x 1080 pixels"], { width: 1080, height: 1080 })[0].result).toBe("verified");
  });
  it("does not treat matching dimensions as proof of a compound request", () => {
    expect(checkRevisionRequirements(["Resize to 1080 x 1080 and change the logo"], { width: 1080, height: 1080 })[0].result).toBe("unverified");
  });
  it("never treats upload notes as evidence that a visual change was made", () => {
    const checks = checkRevisionRequirements(["Make the logo blue"], { note: "Made the logo blue", unchanged: false });
    expect(checks[0].result).toBe("unverified");
  });
  it("flags unchanged files without claiming to understand their contents", () => {
    expect(checkRevisionRequirements(["Fix the headline"], { unchanged: true })[0]).toMatchObject({ result: "unverified", evidence: expect.stringContaining("identical") });
  });
});
