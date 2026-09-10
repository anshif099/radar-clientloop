import { assertChatOrigin, chatError, ChatInputError, requireChatScope } from "@/auth/chat";
import { ensureChatThread } from "@/data/chat";

export async function POST(request: Request) {
  try {
    assertChatOrigin(request);
    const scope = await requireChatScope(request);
    const input = await request.json().catch(() => null);
    if (!input || input.kind !== "COMPANY") throw new ChatInputError("Choose company chat.");
    const thread = await ensureChatThread(scope, "COMPANY");
    return Response.json({ thread: { id: thread.id, kind: thread.kind } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return chatError(error); }
}
