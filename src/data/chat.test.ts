import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const query = vi.hoisted(() => vi.fn());
vi.mock("@/db/client", async () => {
  const { drizzle } = await import("drizzle-orm/mysql2");
  return { db: drizzle({ client: { query } as never }), withAgency: vi.fn() };
});
import { getChatAttachment, getChatThread, listChatMessages, type ChatScope } from "./chat";
const scope: ChatScope = { agencyId: "company-a", workspaceId: "workspace-a", companyName: "A", userId: "user-a", userName: "A", role: "COMPANY" };
beforeEach(() => { query.mockReset().mockResolvedValue([[], []]); });
function assertScopeOnQueries() {
  for (const [configuration, parameters] of query.mock.calls) {
    expect(configuration.sql).toContain("agency_id");
    expect(configuration.sql).toContain("workspace_id");
    expect(parameters).toContain("company-a");
    expect(parameters).toContain("workspace-a");
  }
}
it("constrains chat lookups by tenant and workspace", async () => {
  await expect(getChatThread(scope, "other-company-thread")).rejects.toThrow("NOT_FOUND");
  assertScopeOnQueries();
  expect(query.mock.calls[0][0].sql).toContain("owner_key");
  expect(query.mock.calls[0][1]).toContain("user-a");
});
it("does not read another tenant's message history", async () => {
  await expect(listChatMessages(scope, "other-company-thread")).rejects.toThrow("NOT_FOUND");
  expect(query).toHaveBeenCalledOnce();
  assertScopeOnQueries();
});
it("does not return another tenant's attachment or storage path", async () => {
  await expect(getChatAttachment(scope, "other-company-file")).resolves.toBeNull();
  assertScopeOnQueries();
  expect(query.mock.calls[0][1]).toContain("user-a");
});
it("rejects an empty workspace before querying", async () => {
  await expect(getChatThread({ ...scope, workspaceId: "" }, "thread")).rejects.toThrow("FORBIDDEN");
  expect(query).not.toHaveBeenCalled();
});
