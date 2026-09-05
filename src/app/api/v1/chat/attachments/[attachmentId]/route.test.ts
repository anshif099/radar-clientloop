import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/auth/server", () => ({ requireRequestSession: vi.fn() }));
vi.mock("@/data/companies", () => ({ getCompanyForAdmin: vi.fn(), getCompanyContextForIdentity: vi.fn() }));
vi.mock("@/data/chat", () => ({ getChatAttachment: vi.fn() }));
vi.mock("@/storage/asset-response", () => ({ assetResponse: vi.fn() }));
import { requireRequestSession } from "@/auth/server";
import { getCompanyContextForIdentity } from "@/data/companies";
import { getChatAttachment } from "@/data/chat";
import { assetResponse } from "@/storage/asset-response";
import { GET } from "./route";
const context = { params: Promise.resolve({ attachmentId: "other-company-file" }) };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireRequestSession).mockResolvedValue({ user: { id: "user-a", name: "Company A", role: "user" } } as Awaited<ReturnType<typeof requireRequestSession>>);
  vi.mocked(getCompanyContextForIdentity).mockResolvedValue({ agencyId: "a", workspaceId: "workspace-a", agencyName: "Company A" } as Awaited<ReturnType<typeof getCompanyContextForIdentity>>);
});
it("never streams a cross-company attachment", async () => {
  vi.mocked(getChatAttachment).mockResolvedValue(null);
  expect((await GET(new Request("https://app.test/file"), context)).status).toBe(404);
  expect(assetResponse).not.toHaveBeenCalled();
});
it("forces text downloads and disables private attachment caching", async () => {
  vi.mocked(getChatAttachment).mockResolvedValue({ originalName: "brief.txt", mimeType: "text/plain", storageKey: "private" } as Awaited<ReturnType<typeof getChatAttachment>>);
  vi.mocked(assetResponse).mockResolvedValue(new Response("<script>test</script>"));
  const response = await GET(new Request("https://app.test/file"), context);
  expect(response.headers.get("content-disposition")).toContain("attachment;");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
