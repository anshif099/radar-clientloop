import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { assertChatOrigin, chatError, ChatInputError, requireChatScope } from "@/auth/chat";
import { getChatThread, listChatMessages, saveChatMessage, type NewChatAttachment } from "@/data/chat";
import { getAiWorkItem } from "@/data/ai";
import { answerLocally } from "@/ai/local-assistant";
import { detectChatUpload } from "@/domain/chat-upload";
import { maxChatBytes, maxChatFiles, maxChatText } from "@/domain/chat";
import { deleteObject, putObject } from "@/storage/filesystem";

export const runtime = "nodejs";
type Context = { params: Promise<{ threadId: string }> };
function validId(id: string) { if (!z.uuid().safeParse(id).success) throw new ChatInputError("Invalid conversation identifier."); }
function formText(form: FormData, key: string) { const value = form.get(key); return typeof value === "string" ? value.trim() : ""; }
export async function GET(request: Request, context: Context) {
  try {
    const scope = await requireChatScope(request);
    const { threadId } = await context.params;
    validId(threadId);
    const query = new URL(request.url).searchParams;
    const before = query.has("before") ? Number(query.get("before")) : undefined;
    const after = query.has("after") ? Number(query.get("after")) : undefined;
    if ((before !== undefined && after !== undefined) || (before !== undefined && (!Number.isSafeInteger(before) || before <= 0)) || (after !== undefined && (!Number.isSafeInteger(after) || after < 0))) throw new ChatInputError("Invalid history cursor.");
    return Response.json(await listChatMessages(scope, threadId, { before, after }), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return chatError(error); }
}
export async function POST(request: Request, context: Context) {
  const stored: string[] = [];
  let committed = false;
  try {
    assertChatOrigin(request);
    const scope = await requireChatScope(request);
    const { threadId } = await context.params;
    validId(threadId);
    const thread = await getChatThread(scope, threadId);
    const length = Number(request.headers.get("content-length"));
    if (length > maxChatBytes + 1024 * 1024) throw new ChatInputError("Attachments must total 100 MB or less.");
    const form = await request.formData();
    const body = formText(form, "body");
    const clientMessageId = formText(form, "clientMessageId");
    const afterValue = formText(form, "after");
    const after = afterValue ? Number(afterValue) : undefined;
    if (after !== undefined && (!Number.isSafeInteger(after) || after < 0)) throw new ChatInputError("Invalid history cursor.");
    let workItemId = formText(form, "workItemId");
    if (!z.uuid().safeParse(clientMessageId).success) throw new ChatInputError("A message retry identifier is required.");
    if (workItemId && !z.uuid().safeParse(workItemId).success) throw new ChatInputError("Invalid post identifier.");
    const entries = form.getAll("files");
    if (entries.some((entry) => !(entry instanceof File))) throw new ChatInputError("Invalid attachment.");
    const files = entries as File[];
    if ((!body && !files.length) || body.length > maxChatText) throw new ChatInputError("Enter a message up to 8,000 characters or attach a file.");
    if (files.length > maxChatFiles || files.reduce((sum, file) => sum + file.size, 0) > maxChatBytes) throw new ChatInputError("Attach up to 5 files totaling 100 MB or less.");
    if (thread.kind === "AI" && files.length) throw new ChatInputError("Share attachments in company chat. For AI revision checks, choose a published post.");
    if (thread.kind === "AI") {
      if (!workItemId) {
        const history = await listChatMessages(scope, threadId);
        // Resolve follow-ups from persisted history, never from another user's room.
        const previous = [...history.messages].reverse().find((message) => typeof message.metadata.workItemId === "string");
        if (/\b(it|that|this|version|v\d+)\b/i.test(body)) workItemId = String(previous?.metadata.workItemId ?? "");
      }
      if (workItemId) await getAiWorkItem(scope, workItemId);
    }
    const attachments: NewChatAttachment[] = [];
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const detected = detectChatUpload(bytes, file.name, file.type);
      if (!detected) throw new ChatInputError(`Unsupported, empty, mismatched, or oversized file: ${file.name.slice(0, 100)}. Images/documents: 20 MB, voice: 25 MB, videos/ZIP: 100 MB.`);
      const id = randomUUID();
      const storageKey = `agencies/${scope.agencyId}/chat/${thread.id}/${id}.${detected.extension}`;
      await putObject({ key: storageKey, bytes, contentType: detected.mimeType });
      stored.push(storageKey);
      const originalName = [...file.name].map((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 || "/\\".includes(character) ? "_" : character).join("").slice(0, 255);
      attachments.push({ id, storageKey, originalName, mimeType: detected.mimeType, sizeBytes: file.size, checksumSha256: createHash("sha256").update(bytes).digest("hex") });
    }
    const saved = await saveChatMessage(scope, threadId, { body, clientMessageId, attachments, metadata: workItemId ? { workItemId } : {} });
    committed = saved.created;
    if (!saved.created) await Promise.all(stored.map((key) => deleteObject(key).catch(() => undefined)));
    if (thread.kind === "AI") {
      // Synchronous local execution: the request returns only after both messages persist.
      // Retry uses the same unique key, including when the earlier request was interrupted.
      const reply = await answerLocally(scope, saved.body, typeof saved.metadata.workItemId === "string" ? saved.metadata.workItemId : undefined);
      if (reply.body.length > 14000) reply.body = `${reply.body.slice(0, 13800)}\n\nReport shortened. Review the original feedback and version files for the complete record.`;
      await saveChatMessage(scope, threadId, { ...reply, clientMessageId, assistant: true });
    }
    return Response.json({ messageId: saved.id, ...(await listChatMessages(scope, threadId, { after })) }, { status: saved.created ? 201 : 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (!committed) await Promise.all(stored.map((key) => deleteObject(key).catch(() => undefined)));
    return chatError(error);
  }
}
