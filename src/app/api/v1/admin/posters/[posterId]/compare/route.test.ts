import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/auth/chat", () => ({ assertChatOrigin: vi.fn() }));
vi.mock("@/auth/server", () => ({ requireRequestSuperAdmin: vi.fn() }));
vi.mock("@/data/revision-comparison", () => ({ getRevisionComparisonSource: vi.fn() }));
vi.mock("@/revision/revision-check", () => ({
  RevisionComparisonInputError: class RevisionComparisonInputError extends Error {},
  analyzeRevision: vi.fn(),
}));
import { analyzeRevision } from "@/revision/revision-check";
import { requireRequestSuperAdmin } from "@/auth/server";
import { getRevisionComparisonSource } from "@/data/revision-comparison";
import { POST } from "./route";

const posterId = "33333333-3333-4333-8333-333333333333";
const source = {
  posterId,
  title: "Campaign",
  requestedVersion: { versionNumber: 1, note: "", asset: { storageKey: "before", originalName: "v1.png", mimeType: "image/png", sizeBytes: 10 } },
  currentVersion: { versionNumber: 2, note: "Logo enlarged", asset: { storageKey: "after", originalName: "v2.png", mimeType: "image/png", sizeBytes: 10 } },
  feedback: ["Make the logo larger"],
};

function request() { return new Request(`https://app.test/api/v1/admin/posters/${posterId}/compare`, { method: "POST" }); }
function context(id = posterId) { return { params: Promise.resolve({ posterId: id }) }; }

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireRequestSuperAdmin).mockResolvedValue({ user: { id: "admin" } } as Awaited<ReturnType<typeof requireRequestSuperAdmin>>);
  vi.mocked(getRevisionComparisonSource).mockResolvedValue(source);
});

describe("revision comparison", () => {
  it("returns the checklist generated from authorized stored versions", async () => {
    vi.mocked(analyzeRevision).mockResolvedValue({
      verdict: "READY",
      summary: "The logo is larger.",
      requirements: [{ request: "Make the logo larger", status: "MET", evidence: "The revised logo occupies more space." }],
      visualChanges: ["Logo increased in size"],
      warnings: [],
      compared: { fromVersion: 1, toVersion: 2 },
    });
    const response = await POST(request(), context());
    expect(response.status).toBe(200);
    expect((await response.json()).verdict).toBe("READY");
    expect(analyzeRevision).toHaveBeenCalledWith(source);
  });

  it("explains when there is no requested-change version to compare", async () => {
    vi.mocked(getRevisionComparisonSource).mockResolvedValue(null);
    const response = await POST(request(), context());
    expect(response.status).toBe(409);
    expect(analyzeRevision).not.toHaveBeenCalled();
  });

  it("rejects invalid poster identifiers before reading files", async () => {
    expect((await POST(request(), context("bad"))).status).toBe(404);
    expect(getRevisionComparisonSource).not.toHaveBeenCalled();
  });
});
