import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, lt, or } from "drizzle-orm";
import { db, withAgency } from "@/db/client";
import { auditEvents, chatAttachments, chatMessages, chatThreads } from "@/db/schema";
import type { ChatKind, ChatMessage } from "@/domain/chat";

export interface ChatScope {
  agencyId: string;
  workspaceId: string;
  companyName: string;
  userId: string;
  userName: string;
  role: "ADMIN" | "COMPANY";
}
export function threadScope(scope: ChatScope) {
  if (!scope.agencyId || !scope.workspaceId || !scope.userId) throw new Error("FORBIDDEN");
  return and(
    eq(chatThreads.agencyId, scope.agencyId), eq(chatThreads.workspaceId, scope.workspaceId),
    or(and(eq(chatThreads.kind, "COMPANY"), eq(chatThreads.ownerKey, "")), and(eq(chatThreads.kind, "AI"), eq(chatThreads.ownerKey, scope.userId))),
  );
}
export async function ensureChatThread(scope: ChatScope, kind: ChatKind) {
  const ownerKey = kind === "AI" ? scope.userId : "";
  return withAgency(scope.agencyId, async (tx) => {
    await tx.insert(chatThreads).values({ id: randomUUID(), agencyId: scope.agencyId, workspaceId: scope.workspaceId, kind, ownerKey })
      .onDuplicateKeyUpdate({ set: { ownerKey } });
    const [thread] = await tx.select().from(chatThreads).where(and(threadScope(scope), eq(chatThreads.kind, kind), eq(chatThreads.ownerKey, ownerKey))).limit(1);
    if (!thread) throw new Error("NOT_FOUND");
    return thread;
  });
}
export async function getChatThread(scope: ChatScope, threadId: string) {
  const [thread] = await db.select().from(chatThreads).where(and(threadScope(scope), eq(chatThreads.id, threadId))).limit(1);
  if (!thread) throw new Error("NOT_FOUND");
  return thread;
}
export async function listChatMessages(scope: ChatScope, threadId: string, cursor: { before?: number; after?: number } = {}) {
  await getChatThread(scope, threadId);
  const rows = await db.select({ message: chatMessages }).from(chatMessages)
    .innerJoin(chatThreads, eq(chatThreads.id, chatMessages.threadId))
    .where(and(threadScope(scope), eq(chatMessages.threadId, threadId), cursor.before ? lt(chatMessages.id, cursor.before) : undefined, cursor.after !== undefined ? gt(chatMessages.id, cursor.after) : undefined))
    .orderBy(cursor.after !== undefined ? asc(chatMessages.id) : desc(chatMessages.id)).limit(51);
  const hasMore = rows.length > 50;
  const page = rows.slice(0, 50);
  if (cursor.after === undefined) page.reverse();
  const attachments = page.length ? await db.select({ attachment: chatAttachments }).from(chatAttachments)
    .innerJoin(chatMessages, eq(chatMessages.id, chatAttachments.messageId))
    .innerJoin(chatThreads, eq(chatThreads.id, chatMessages.threadId))
    .where(and(threadScope(scope), eq(chatThreads.id, threadId), inArray(chatAttachments.messageId, page.map(({ message }) => message.id)))) : [];
  const messages: ChatMessage[] = page.map(({ message }) => ({ ...message, createdAt: message.createdAt.toISOString(), attachments: attachments
    .filter(({ attachment }) => attachment.messageId === message.id)
    .map(({ attachment: { id, originalName, mimeType, sizeBytes } }) => ({ id, originalName, mimeType, sizeBytes })) }));
  return { messages, hasMore };
}
export type NewChatAttachment = Omit<typeof chatAttachments.$inferInsert, "messageId">;
export async function saveChatMessage(scope: ChatScope, threadId: string, input: {
  body: string; clientMessageId: string; attachments?: NewChatAttachment[];
  assistant?: boolean; metadata?: Record<string, unknown>;
}) {
  return withAgency(scope.agencyId, async (tx) => {
    // Serialize retries within a room so a lost HTTP response never duplicates a message.
    const [thread] = await tx.select().from(chatThreads).where(and(threadScope(scope), eq(chatThreads.id, threadId))).limit(1).for("update");
    if (!thread || (input.assistant && thread.kind !== "AI")) throw new Error("NOT_FOUND");
    const senderId = input.assistant ? "clientloop-ai-ultra" : scope.userId;
    const [existing] = await tx.select({ id: chatMessages.id, body: chatMessages.body, metadata: chatMessages.metadata }).from(chatMessages)
      .where(and(eq(chatMessages.threadId, threadId), eq(chatMessages.senderId, senderId), eq(chatMessages.clientMessageId, input.clientMessageId))).limit(1);
    if (existing) return { ...existing, created: false };
    const [message] = await tx.insert(chatMessages).values({
      threadId, senderId, senderName: input.assistant ? "ClientLoop AI Ultra" : scope.userName.slice(0, 160),
      senderRole: input.assistant ? "ASSISTANT" : scope.role,
      body: input.body, clientMessageId: input.clientMessageId, metadata: input.metadata ?? {},
    }).$returningId();
    if (input.attachments?.length) await tx.insert(chatAttachments).values(input.attachments.map((attachment) => ({ ...attachment, messageId: message.id })));
    await tx.update(chatThreads).set({ updatedAt: new Date() }).where(and(threadScope(scope), eq(chatThreads.id, threadId)));
    await tx.insert(auditEvents).values({ agencyId: scope.agencyId, workspaceId: scope.workspaceId, actorType: input.assistant ? "LOCAL_ASSISTANT" : scope.role, actorId: scope.userId,
      action: "CHAT_MESSAGE_CREATED", resourceType: "CHAT_THREAD", resourceId: threadId, metadata: { messageId: message.id, attachmentCount: input.attachments?.length ?? 0 } });
    return { id: message.id, body: input.body, metadata: input.metadata ?? {}, created: true };
  });
}
export async function getChatAttachment(scope: ChatScope, attachmentId: string): Promise<typeof chatAttachments.$inferSelect | null> {
  const [row] = await db.select({ attachment: chatAttachments }).from(chatAttachments)
    .innerJoin(chatMessages, eq(chatMessages.id, chatAttachments.messageId))
    .innerJoin(chatThreads, eq(chatThreads.id, chatMessages.threadId))
    .where(and(threadScope(scope), eq(chatAttachments.id, attachmentId))).limit(1);
  return row?.attachment ?? null;
}
