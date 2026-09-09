import { z } from "zod";
import { answerLocally } from "@/ai/local-assistant";
import { assertChatOrigin, chatError, ChatInputError, requireChatScope } from "@/auth/chat";
import { getChatThread, getUserChatMessage, listChatMessages, saveChatMessage } from "@/data/chat";
import { browserAiModel, maxBrowserAiReply } from "@/domain/browser-ai";

export const runtime = "nodejs";
type Context = { params: Promise<{ threadId: string }> };

const inputSchema = z.object({
  sourceMessageId: z.number().int().positive(),
  clientMessageId: z.uuid(),
  body: z.string().min(1).max(maxBrowserAiReply).optional(),
  fallback: z.boolean().optional(),
  after: z.number().int().nonnegative().optional(),
}).refine((value) => value.fallback || value.body, { message: "A browser reply or fallback request is required." });

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
    const fallbackReply = parsed.data.fallback ? await answerLocally(scope, source.body, workItemId) : null;
    const body = (fallbackReply?.body ?? parsed.data.body ?? "").trim();
    if (!body) throw new ChatInputError("The AI assistant returned an empty reply.");
    const saved = await saveChatMessage(scope, threadId, {
      body,
      clientMessageId: parsed.data.clientMessageId,
      assistant: true,
      metadata: fallbackReply
        ? { ...fallbackReply.metadata, engine: "clientloop-local-fallback", sourceMessageId: source.id, ...(workItemId ? { workItemId } : {}) }
        : { engine: "webllm-webgpu", model: browserAiModel, sourceMessageId: source.id, ...(workItemId ? { workItemId } : {}) },
    });
    return Response.json({ messageId: saved.id, ...(await listChatMessages(scope, threadId, { after: parsed.data.after })) }, {
      status: saved.created ? 201 : 200,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return chatError(error);
  }
}
