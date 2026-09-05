import { and, asc, eq, gt, ne } from "drizzle-orm";
import { chatError, requireChatScope } from "@/auth/chat";
import { db } from "@/db/client";
import { workItems } from "@/db/schema";

export async function GET(request: Request) {
  try {
    const scope = await requireChatScope(request);
    const after = new URL(request.url).searchParams.get("after");
    const posts = await db.select({ id: workItems.id, title: workItems.title }).from(workItems)
      .where(and(eq(workItems.agencyId, scope.agencyId), eq(workItems.workspaceId, scope.workspaceId), ne(workItems.status, "ARCHIVED"), ne(workItems.status, "DRAFT"), after ? gt(workItems.id, after) : undefined))
      .orderBy(asc(workItems.id)).limit(101);
    return Response.json({ posts: posts.slice(0, 100), next: posts.length > 100 ? posts[99].id : null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return chatError(error); }
}
