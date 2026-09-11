import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/auth/server", () => ({ requireRequestAdmin: vi.fn() }));
vi.mock("@/data/companies", () => ({ deletePoster: vi.fn() }));
vi.mock("@/storage/filesystem", () => ({ deleteObject: vi.fn() }));

import { requireRequestAdmin } from "@/auth/server";
import { deletePoster } from "@/data/companies";
import { deleteObject } from "@/storage/filesystem";
import { DELETE } from "./route";

const posterId = "33333333-3333-4333-8333-333333333333";
const request = () => new Request(`https://app.test/api/v1/admin/posters/${posterId}`, { method: "DELETE" });
const context = (id = posterId) => ({ params: Promise.resolve({ posterId: id }) });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireRequestAdmin).mockResolvedValue({ user: { id: "admin" } } as Awaited<ReturnType<typeof requireRequestAdmin>>);
  vi.mocked(deletePoster).mockResolvedValue({
    id: posterId,
    title: "Campaign",
    companyId: "company",
    projectId: "project",
    storageKeys: ["private/v1.png", "private/v2.png"],
  });
  vi.mocked(deleteObject).mockResolvedValue(undefined);
});

describe("poster deletion", () => {
  it("deletes poster data and every stored version", async () => {
    const response = await DELETE(request(), context());
    expect(response.status).toBe(200);
    expect(deletePoster).toHaveBeenCalledWith({ posterId, actorId: "admin" });
    expect(deleteObject).toHaveBeenCalledTimes(2);
    expect(await response.json()).toEqual({ poster: { id: posterId }, cleanupPending: 0 });
  });

  it("reports deferred file cleanup without restoring deleted database data", async () => {
    vi.mocked(deleteObject).mockRejectedValueOnce(new Error("disk unavailable"));
    const response = await DELETE(request(), context());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ poster: { id: posterId }, cleanupPending: 1 });
  });

  it("rejects invalid identifiers before deleting", async () => {
    expect((await DELETE(request(), context("invalid"))).status).toBe(400);
    expect(deletePoster).not.toHaveBeenCalled();
  });

  it("requires Super Admin access", async () => {
    vi.mocked(requireRequestAdmin).mockRejectedValue(new Error("FORBIDDEN"));
    expect((await DELETE(request(), context())).status).toBe(403);
    expect(deletePoster).not.toHaveBeenCalled();
  });
});
