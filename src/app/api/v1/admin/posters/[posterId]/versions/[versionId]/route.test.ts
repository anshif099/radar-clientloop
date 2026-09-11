import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/auth/server", () => ({ requireRequestAdmin: vi.fn() }));
vi.mock("@/data/companies", () => ({ deletePosterVersion: vi.fn() }));
vi.mock("@/storage/filesystem", () => ({ deleteObject: vi.fn() }));

import { requireRequestAdmin } from "@/auth/server";
import { deletePosterVersion } from "@/data/companies";
import { deleteObject } from "@/storage/filesystem";
import { DELETE } from "./route";

const posterId = "33333333-3333-4333-8333-333333333333";
const versionId = "44444444-4444-4444-8444-444444444444";
const request = () => new Request(`https://app.test/api/v1/admin/posters/${posterId}/versions/${versionId}`, { method: "DELETE" });
const context = (poster = posterId, version = versionId) => ({ params: Promise.resolve({ posterId: poster, versionId: version }) });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireRequestAdmin).mockResolvedValue({ user: { id: "admin" } } as Awaited<ReturnType<typeof requireRequestAdmin>>);
  vi.mocked(deletePosterVersion).mockResolvedValue({
    posterId,
    versionId,
    versionNumber: 2,
    currentVersionId: "55555555-5555-4555-8555-555555555555",
    storageKeys: ["private/v2.png"],
  });
  vi.mocked(deleteObject).mockResolvedValue(undefined);
});

describe("poster version deletion", () => {
  it("deletes only the selected version and its stored files", async () => {
    const response = await DELETE(request(), context());
    expect(response.status).toBe(200);
    expect(deletePosterVersion).toHaveBeenCalledWith({ posterId, versionId, actorId: "admin" });
    expect(deleteObject).toHaveBeenCalledWith("private/v2.png");
    expect(await response.json()).toEqual({
      version: { id: versionId, versionNumber: 2, currentVersionId: "55555555-5555-4555-8555-555555555555" },
      cleanupPending: 0,
    });
  });

  it("requires whole-poster deletion for the last version", async () => {
    vi.mocked(deletePosterVersion).mockRejectedValue(new Error("LAST_VERSION"));
    const response = await DELETE(request(), context());
    expect(response.status).toBe(409);
  });

  it("validates both identifiers", async () => {
    expect((await DELETE(request(), context("invalid", versionId))).status).toBe(400);
    expect((await DELETE(request(), context(posterId, "invalid"))).status).toBe(400);
    expect(deletePosterVersion).not.toHaveBeenCalled();
  });

  it("requires Super Admin access", async () => {
    vi.mocked(requireRequestAdmin).mockRejectedValue(new Error("FORBIDDEN"));
    expect((await DELETE(request(), context())).status).toBe(403);
  });
});
