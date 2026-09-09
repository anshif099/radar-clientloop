import { z } from "zod";
import { assertChatOrigin, chatError, ChatInputError, requireChatScope } from "@/auth/chat";
import { getChatThread, getUserChatMessage, listChatMessages, saveChatMessage } from "@/data/chat";
import { browserCpuAiModel, browserGpuAiModels, maxBrowserAiReply } from "@/domain/browser-ai";

export const runtime = "nodejs";
type Context = { params: Promise<{ threadId: string }> };

const replyFields = {
  sourceMessageId: z.number().int().positive(),
  clientMessageId: z.uuid(),
  body: z.string().min(1).max(maxBrowserAiReply),
  after: z.number().int().nonnegative().optional(),
};
const inputSchema = z.discriminatedUnion("engine", [
  z.object({ ...replyFields, engine: z.literal("webllm-webgpu"), model: z.enum(browserGpuAiModels) }),
  z.object({ ...replyFields, engine: z.literal("transformers-wasm"), model: z.literal(browserCpuAiModel) }),
]);

export async function POST(request: Request, context: Context) {
  try {
    assertChatOrigin(request);
    const scope = await requireChatScope(request);
    const { threadId } = await context.params;
    if (!z.uuid().safeParse(threadId).success) throw new ChatInputError("Invalid conversation identifier.");
    const thread = await getChatThread(scope, threadId);
    if (thread.kind !== "AI") throw new ChatInputError("Browser AI replies are only available in AI Ultra.");
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) throw new ChatInputError("Invalid browser AI reply.");
    const source = await getUserChatMessage(scope, threadId, parsed.data.sourceMessageId);
    if (!source || source.clientMessageId !== parsed.data.clientMessageId) throw new ChatInputError("The original AI question could not be verified.");
    const workItemId = typeof source.metadata.workItemId === "string" ? source.metadata.workItemId : undefined;
    const body = parsed.data.body.trim();
    if (!body) throw new ChatInputError("The browser AI returned an empty reply.");
    const saved = await saveChatMessage(scope, threadId, {
      body,
      clientMessageId: parsed.data.clientMessageId,
      assistant: true,
      metadata: { engine: parsed.data.engine, model: parsed.data.model, sourceMessageId: source.id, ...(workItemId ? { workItemId } : {}) },
    });
    return Response.json({ messageId: saved.id, ...(await listChatMessages(scope, threadId, { after: parsed.data.after })) }, {
      status: saved.created ? 201 : 200,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return chatError(error);
  }
}
