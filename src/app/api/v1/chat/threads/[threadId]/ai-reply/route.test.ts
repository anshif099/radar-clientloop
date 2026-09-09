import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/auth/server", () => ({ requireRequestSession: vi.fn() }));
vi.mock("@/data/companies", () => ({ getCompanyForAdmin: vi.fn(), getCompanyContextForIdentity: vi.fn() }));
vi.mock("@/data/chat", () => ({ getChatThread: vi.fn(), getUserChatMessage: vi.fn(), listChatMessages: vi.fn(), saveChatMessage: vi.fn() }));

import { requireRequestSession } from "@/auth/server";
import { getCompanyContextForIdentity } from "@/data/companies";
import { getChatThread, getUserChatMessage, listChatMessages, saveChatMessage } from "@/data/chat";
import { browserAiModel } from "@/domain/browser-ai";
import { POST } from "./route";

const threadId = "11111111-1111-4111-8111-111111111111";
const clientMessageId = "22222222-2222-4222-8222-222222222222";
const context = { params: Promise.resolve({ threadId }) };

function request(overrides: Record<string, unknown> = {}) {
  return new Request(`https://app.test/ai-reply?companyId=a`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceMessageId: 7, clientMessageId, body: "There is 1 company.", model: browserAiModel, after: 7, ...overrides }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireRequestSession).mockResolvedValue({ user: { id: "user-a", name: "User A", role: "user" } } as Awaited<ReturnType<typeof requireRequestSession>>);
  vi.mocked(getCompanyContextForIdentity).mockResolvedValue({ agencyId: "a", workspaceId: "workspace-a", agencyName: "Company A" } as Awaited<ReturnType<typeof getCompanyContextForIdentity>>);
  vi.mocked(getChatThread).mockResolvedValue({ id: threadId, kind: "AI" } as Awaited<ReturnType<typeof getChatThread>>);
  vi.mocked(getUserChatMessage).mockResolvedValue({ id: 7, body: "How many companies do I have?", clientMessageId, metadata: {}, senderId: "user-a" } as Awaited<ReturnType<typeof getUserChatMessage>>);
  vi.mocked(saveChatMessage).mockResolvedValue({ id: 8, body: "There is 1 company.", metadata: {}, created: true });
  vi.mocked(listChatMessages).mockResolvedValue({ messages: [], hasMore: false });
});

it("saves a verified browser-generated reply with engine metadata", async () => {
  const response = await POST(request(), context);
  expect(response.status).toBe(201);
  expect(getUserChatMessage).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-a" }), threadId, 7);
  expect(saveChatMessage).toHaveBeenCalledWith(expect.anything(), threadId, {
    body: "There is 1 company.",
    clientMessageId,
    assistant: true,
    metadata: { engine: "webllm-webgpu", model: browserAiModel, sourceMessageId: 7 },
  });
});

it("rejects replies claiming an unapproved browser model", async () => {
  expect((await POST(request({ model: "unknown-model" }), context)).status).toBe(400);
  expect(saveChatMessage).not.toHaveBeenCalled();
});

it("rejects a reply that does not match the original user's retry id", async () => {
  expect((await POST(request({ clientMessageId: "33333333-3333-4333-8333-333333333333" }), context)).status).toBe(400);
  expect(saveChatMessage).not.toHaveBeenCalled();
});

it("does not allow browser AI replies in a shared company thread", async () => {
  vi.mocked(getChatThread).mockResolvedValue({ id: threadId, kind: "COMPANY" } as Awaited<ReturnType<typeof getChatThread>>);
  expect((await POST(request(), context)).status).toBe(400);
  expect(getUserChatMessage).not.toHaveBeenCalled();
});
