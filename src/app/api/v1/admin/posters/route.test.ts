import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@/auth/server", () => ({ requireRequestSuperAdmin: vi.fn() }));
vi.mock("@/data/companies", () => ({ createPoster: vi.fn(), createPosterVersion: vi.fn(), getCompanyForAdmin: vi.fn(), getProjectForAdmin: vi.fn() }));
vi.mock("@/storage/filesystem", () => ({ putObject: vi.fn(), deleteObject: vi.fn() }));

import { requireRequestSuperAdmin } from "@/auth/server";
import { createPoster, createPosterVersion, getCompanyForAdmin, getProjectForAdmin } from "@/data/companies";
import { deleteObject, putObject } from "@/storage/filesystem";
import { POST } from "./route";

const companyId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const posterId = "33333333-3333-4333-8333-333333333333";
function formRequest(type: string, file?: File) {
  const form = new FormData();
  form.set("companyId", companyId);
  form.set("projectId", projectId);
  form.set("title", "Client review");
  form.set("contentType", type);
  if (file) form.set("file", file);
  return form;
}
function request(form: FormData) {
  return new Request("https://app.test/api/v1/admin/posters", { method: "POST", body: form });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireRequestSuperAdmin).mockResolvedValue({ user: { id: "admin" } } as Awaited<ReturnType<typeof requireRequestSuperAdmin>>);
  vi.mocked(getCompanyForAdmin).mockResolvedValue({ id: companyId, workspaceId: "workspace" } as Awaited<ReturnType<typeof getCompanyForAdmin>>);
  vi.mocked(getProjectForAdmin).mockResolvedValue({ id: projectId } as Awaited<ReturnType<typeof getProjectForAdmin>>);
  vi.mocked(createPoster).mockResolvedValue({ id: posterId, assetId: companyId, versionId: projectId, versionNumber: 1, title: "Client review" });
  vi.mocked(createPosterVersion).mockResolvedValue({ id: posterId, assetId: companyId, versionId: projectId, versionNumber: 2, title: "Client review" });
  vi.mocked(putObject).mockResolvedValue(undefined);
  vi.mocked(deleteObject).mockResolvedValue(undefined);
});

it("publishes a website without requiring a file", async () => {
  const form = formRequest("website");
  form.set("websiteUrl", "https://example.com/?q=design#v2");
  const response = await POST(request(form));
  expect(response.status).toBe(201);
  expect(createPoster).toHaveBeenCalledWith(expect.objectContaining({ mimeType: "text/uri-list", originalName: "example.com" }));
  expect(new TextDecoder().decode(vi.mocked(putObject).mock.calls[0][0].bytes)).toBe("https://example.com/?q=design#v2\r\n");
  expect((await response.json()).poster.contentType).toBe("website");
});
it("uses detected content even when the browser supplies a generic MIME type", async () => {
  const form = formRequest("pdf", new File(["%PDF-1.7"], "design.pdf", { type: "application/octet-stream" }));
  expect((await POST(request(form))).status).toBe(201);
  expect(createPoster).toHaveBeenCalledWith(expect.objectContaining({ mimeType: "application/pdf", originalName: "design.pdf" }));
});
it("rejects a selected type that does not match the file", async () => {
  const form = formRequest("image", new File(["%PDF-1.7"], "design.pdf"));
  expect((await POST(request(form))).status).toBe(400);
  expect(putObject).not.toHaveBeenCalled();
});
it.each(["invalid", "website"])("rejects missing or invalid input for %s", async (type) => {
  expect((await POST(request(formRequest(type)))).status).toBe(400);
  expect(createPoster).not.toHaveBeenCalled();
});
it("publishes a link revision against the existing item", async () => {
  const form = formRequest("website");
  form.set("posterId", posterId);
  form.set("websiteUrl", "https://example.com/v2");
  expect((await POST(request(form))).status).toBe(201);
  expect(createPosterVersion).toHaveBeenCalledWith(expect.objectContaining({ posterId, mimeType: "text/uri-list" }));
  expect(createPoster).not.toHaveBeenCalled();
});
it("cleans up the new stored asset if the target version cannot be found", async () => {
  const form = formRequest("website");
  form.set("posterId", posterId);
  form.set("websiteUrl", "https://example.com");
  vi.mocked(createPosterVersion).mockRejectedValue(new Error("POSTER_NOT_FOUND"));
  expect((await POST(request(form))).status).toBe(404);
  expect(deleteObject).toHaveBeenCalledWith(vi.mocked(putObject).mock.calls[0][0].key);
});
it("requires admin authorization before publishing any content", async () => {
  vi.mocked(requireRequestSuperAdmin).mockRejectedValue(new Error("FORBIDDEN"));
  expect((await POST(request(formRequest("website")))).status).toBe(403);
  expect(putObject).not.toHaveBeenCalled();
});
