import { beforeEach, expect, it, vi } from "vitest";
import sharp from "sharp";
vi.mock("server-only", () => ({}));
vi.mock("@/data/ai", () => ({ getAiWorkItem: vi.fn(), searchAiWorkspace: vi.fn() }));
vi.mock("@/storage/filesystem", () => ({ objectSize: vi.fn(), readObject: vi.fn() }));
import { getAiWorkItem } from "@/data/ai";
import { objectSize, readObject } from "@/storage/filesystem";
import { answerLocally } from "./local-assistant";
import type { ChatScope } from "@/data/chat";
const scope: ChatScope = { agencyId: "a", workspaceId: "w", companyName: "Company A", userId: "u", userName: "User", role: "COMPANY" };
beforeEach(async () => {
  vi.resetAllMocks();
  const bytes = await sharp({ create: { width: 128, height: 128, channels: 3, background: "#ff0000" } }).png().toBuffer();
  vi.mocked(objectSize).mockResolvedValue(bytes.length);
  vi.mocked(readObject).mockImplementation(async () => new Response(new Uint8Array(bytes)).body!);
  vi.mocked(getAiWorkItem).mockResolvedValue({
    item: { id: "post", title: "Summer launch", currentVersionId: "v2", status: "AWAITING_CLIENT_REVIEW" },
    versions: [
      { version: { id: "v2", versionNumber: 2, note: "Changed everything" }, asset: { id: "asset2", storageKey: "v2", originalName: "v2.png", detectedMimeType: "image/png" } },
      { version: { id: "v1", versionNumber: 1 }, asset: { id: "asset1", storageKey: "v1", originalName: "v1.png", detectedMimeType: "image/png" } },
    ],
    reviews: [{ id: "review", versionId: "v1", decision: "REQUEST_CHANGES", reviewerLabel: "Client", decidedAt: new Date("2026-09-01T10:00:00Z") }],
    feedback: [{ reviewDecisionId: "review", kind: "TEXT", textContent: "Please resize to 1080 x 1080 pixels\nMake the logo blue" }],
  } as Awaited<ReturnType<typeof getAiWorkItem>>);
});
it("compares real file bytes and dimensions and preserves unverified requests", async () => {
  const network = vi.spyOn(globalThis, "fetch");
  try {
    const reply = await answerLocally(scope, "Analyze v2", "post");
    expect(reply.body).toContain("identical to version 1");
    expect(reply.body).toContain("128 × 128px");
    expect(reply.metadata).toMatchObject({ verdict: "MISSING_CHANGES", checks: [expect.objectContaining({ result: "missing" }), expect.objectContaining({ result: "unverified" })], reviewDecisionId: "review" });
    expect(network).not.toHaveBeenCalled();
  } finally { network.mockRestore(); }
});
it("reports unreadable files without claiming the revision is complete", async () => {
  vi.mocked(objectSize).mockRejectedValue(new Error("ENOENT"));
  const reply = await answerLocally(scope, "Is this perfect?", "post");
  expect(reply.metadata.verdict).toBe("NEEDS_REVIEW");
  expect(reply.body).toContain("could not be inspected");
});
it("does not silently substitute a different requested version", async () => {
  const reply = await answerLocally(scope, "Analyze version 9", "post");
  expect(reply.body).toContain("not available");
  expect(readObject).not.toHaveBeenCalled();
});
it("compares the later version when both version numbers are mentioned", async () => {
  const reply = await answerLocally(scope, "Compare v1 with v2", "post");
  expect(reply.body).toContain("Summer launch — version 2");
  expect(reply.body).toContain("identical to version 1");
});
it("answers feedback and history questions from saved records without inspecting files", async () => {
  const feedback = await answerLocally(scope, "What feedback did the client give?", "post");
  expect(feedback.body).toContain("Make the logo blue");
  const history = await answerLocally(scope, "Show version history", "post");
  expect(history.body).toContain("Version 2 (current)");
  expect(readObject).not.toHaveBeenCalled();
});
it("does not mark a truncated checklist as fully passed", async () => {
  const fixture = await getAiWorkItem(scope, "post");
  fixture.feedback[0].textContent = Array.from({ length: 101 }, () => "Resize to 128 x 128 pixels").join("\n");
  vi.mocked(getAiWorkItem).mockResolvedValue(fixture);
  const reply = await answerLocally(scope, "Analyze v2", "post");
  expect(reply.metadata.verdict).toBe("NEEDS_REVIEW");
  expect(reply.body).toContain("Only part of the saved checklist");
});
