import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("./server", () => ({ requireRequestSession: vi.fn() }));
vi.mock("@/data/companies", () => ({ getCompanyForAdmin: vi.fn(), getCompanyContextForIdentity: vi.fn() }));
import { requireRequestSession } from "./server";
import { getCompanyForAdmin, getCompanyContextForIdentity } from "@/data/companies";
import { assertChatOrigin, requireChatScope } from "./chat";
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireRequestSession).mockResolvedValue({ user: { id: "user-a", name: "Company A", role: "user" } } as Awaited<ReturnType<typeof requireRequestSession>>);
  vi.mocked(getCompanyContextForIdentity).mockResolvedValue({ agencyId: "a", workspaceId: "workspace-a", agencyName: "Company A" } as Awaited<ReturnType<typeof getCompanyContextForIdentity>>);
});
it("rejects a forged company selector before any admin lookup", async () => {
  await expect(requireChatScope(new Request("https://app.test/chat?companyId=b"))).rejects.toThrow("FORBIDDEN");
  expect(getCompanyForAdmin).not.toHaveBeenCalled();
});
it("derives company and workspace from authenticated membership", async () => {
  await expect(requireChatScope(new Request("https://app.test/chat"))).resolves.toMatchObject({ agencyId: "a", workspaceId: "workspace-a", userId: "user-a", role: "COMPANY" });
});
it("rejects users whose company has been closed", async () => {
  vi.mocked(getCompanyContextForIdentity).mockResolvedValue(null);
  await expect(requireChatScope(new Request("https://app.test/chat"))).rejects.toThrow("FORBIDDEN");
});
it("requires an active selected company for admin chat", async () => {
  vi.mocked(requireRequestSession).mockResolvedValue({ user: { id: "admin", role: "admin" } } as Awaited<ReturnType<typeof requireRequestSession>>);
  vi.mocked(getCompanyForAdmin).mockResolvedValue(null);
  await expect(requireChatScope(new Request("https://app.test/chat?companyId=closed"))).rejects.toThrow("NOT_FOUND");
});
it("blocks cross-origin message submissions", () => {
  expect(() => assertChatOrigin(new Request("https://app.test/chat", { headers: { origin: "https://evil.test" } }))).toThrow("FORBIDDEN");
  expect(() => assertChatOrigin(new Request("https://app.test/chat", { headers: { origin: "https://app.test" } }))).not.toThrow();
});
