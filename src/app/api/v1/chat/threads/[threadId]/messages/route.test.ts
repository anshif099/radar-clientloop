import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/auth/server", () => ({ requireRequestSession: vi.fn() }));
vi.mock("@/data/companies", () => ({ getCompanyForAdmin: vi.fn(), getCompanyContextForIdentity: vi.fn() }));
vi.mock("@/data/chat", () => ({ getChatThread: vi.fn(), listChatMessages: vi.fn(), saveChatMessage: vi.fn() }));
vi.mock("@/data/ai", () => ({ getAiWorkItem: vi.fn() }));
vi.mock("@/ai/local-assistant", () => ({ answerLocally: vi.fn() }));
vi.mock("@/storage/filesystem", () => ({ putObject: vi.fn(), deleteObject: vi.fn() }));
import { requireRequestSession } from "@/auth/server";
import { getCompanyContextForIdentity } from "@/data/companies";
import { getChatThread, listChatMessages, saveChatMessage } from "@/data/chat";
import { getAiWorkItem } from "@/data/ai";
import { answerLocally } from "@/ai/local-assistant";
import { deleteObject, putObject } from "@/storage/filesystem";
import { GET, POST } from "./route";
const threadId = "11111111-1111-4111-8111-111111111111";
const clientMessageId = "22222222-2222-4222-8222-222222222222";
const context = { params: Promise.resolve({ threadId }) };
function request(files: File[] = [], extra: Record<string, string> = {}) {
  const form = new FormData();
  form.set("body", "Hello"); form.set("clientMessageId", clientMessageId);
  files.forEach((file) => form.append("files", file));
  Object.entries(extra).forEach(([key, value]) => form.set(key, value));
  return new Request(`https://app.test/chat/${threadId}`, { method: "POST", body: form });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireRequestSession).mockResolvedValue({ user: { id: "user-a", name: "Company A", role: "user" } } as Awaited<ReturnType<typeof requireRequestSession>>);
  vi.mocked(getCompanyContextForIdentity).mockResolvedValue({ agencyId: "a", workspaceId: "workspace-a", agencyName: "Company A" } as Awaited<ReturnType<typeof getCompanyContextForIdentity>>);
  vi.mocked(getChatThread).mockResolvedValue({ id: threadId, kind: "COMPANY" } as Awaited<ReturnType<typeof getChatThread>>);
  vi.mocked(listChatMessages).mockResolvedValue({ messages: [], hasMore: false });
  vi.mocked(saveChatMessage).mockResolvedValue({ id: 1, body: "Hello", metadata: {}, created: true });
  vi.mocked(putObject).mockResolvedValue(undefined);
  vi.mocked(deleteObject).mockResolvedValue(undefined);
});
it("blocks unauthenticated reads and writes", async () => {
  vi.mocked(requireRequestSession).mockRejectedValue(new Error("UNAUTHENTICATED"));
  expect((await POST(request(), context)).status).toBe(401);
  expect((await GET(new Request("https://app.test/chat"), context)).status).toBe(401);
  expect(getChatThread).not.toHaveBeenCalled();
});
it("blocks writing another company's thread before reading or storing attachments", async () => {
  vi.mocked(getChatThread).mockRejectedValue(new Error("NOT_FOUND"));
  expect((await POST(request([new File(["%PDF-1.7"], "brief.pdf")]), context)).status).toBe(404);
  expect(getChatThread).toHaveBeenCalledWith(expect.objectContaining({ agencyId: "a", workspaceId: "workspace-a", userId: "user-a" }), threadId);
  expect(putObject).not.toHaveBeenCalled(); expect(saveChatMessage).not.toHaveBeenCalled();
});
it("saves file metadata and the checksum with the message", async () => {
  expect((await POST(request([new File(["%PDF-1.7"], "brief.pdf")]), context)).status).toBe(201);
  expect(saveChatMessage).toHaveBeenCalledWith(expect.anything(), threadId, expect.objectContaining({ clientMessageId, attachments: [expect.objectContaining({ originalName: "brief.pdf", mimeType: "application/pdf", checksumSha256: expect.stringMatching(/^[a-f0-9]{64}$/) })] }));
});
it("cleans up earlier files when any attachment is rejected", async () => {
  expect((await POST(request([new File(["%PDF-1.7"], "brief.pdf"), new File(["bad"], "attack.exe")]), context)).status).toBe(400);
  expect(deleteObject).toHaveBeenCalledWith(vi.mocked(putObject).mock.calls[0][0].key);
  expect(saveChatMessage).not.toHaveBeenCalled();
});
it("cleans up duplicate retry files without creating another stored message", async () => {
  vi.mocked(saveChatMessage).mockResolvedValue({ id: 1, body: "Hello", metadata: {}, created: false });
  expect((await POST(request([new File(["%PDF-1.7"], "brief.pdf")]), context)).status).toBe(200);
  expect(deleteObject).toHaveBeenCalledOnce();
});
it("blocks cross-company post analysis before persisting a prompt", async () => {
  vi.mocked(getChatThread).mockResolvedValue({ id: threadId, kind: "AI" } as Awaited<ReturnType<typeof getChatThread>>);
  vi.mocked(getAiWorkItem).mockRejectedValue(new Error("NOT_FOUND"));
  expect((await POST(request([], { workItemId: clientMessageId }), context)).status).toBe(404);
  expect(saveChatMessage).not.toHaveBeenCalled(); expect(answerLocally).not.toHaveBeenCalled();
});
it("answers from the saved prompt when retrying an interrupted AI request", async () => {
  vi.mocked(getChatThread).mockResolvedValue({ id: threadId, kind: "AI" } as Awaited<ReturnType<typeof getChatThread>>);
  vi.mocked(saveChatMessage).mockResolvedValue({ id: 1, body: "Original saved question", metadata: {}, created: false });
  vi.mocked(answerLocally).mockResolvedValue({ body: "Local answer", metadata: { engine: "local" } });
  expect((await POST(request(), context)).status).toBe(200);
  expect(answerLocally).toHaveBeenCalledWith(expect.anything(), "Original saved question", undefined);
  expect(saveChatMessage).toHaveBeenLastCalledWith(expect.anything(), threadId, expect.objectContaining({ assistant: true, body: "Local answer", clientMessageId }));
});
it("rejects ambiguous cursors but accepts incremental polling of an empty room", async () => {
  expect((await GET(new Request("https://app.test/chat?before=1&after=2"), context)).status).toBe(400);
  expect((await GET(new Request("https://app.test/chat?after=0"), context)).status).toBe(200);
  expect(listChatMessages).toHaveBeenCalledWith(expect.anything(), threadId, { before: undefined, after: 0 });
});
