import "server-only";
import { and, count, desc, eq, gte, like, ne, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { assets, divisions, feedbackEntries, reviewDecisions, versionAssets, workItems, workItemVersions } from "@/db/schema";
import type { ChatScope } from "./chat";
import type { LocalIntent } from "@/domain/local-ai";

function itemScope(scope: ChatScope) {
  if (!scope.agencyId || !scope.workspaceId) throw new Error("FORBIDDEN");
  return and(eq(workItems.agencyId, scope.agencyId), eq(workItems.workspaceId, scope.workspaceId), ne(workItems.status, "ARCHIVED"), ne(workItems.status, "DRAFT"));
}
export async function searchAiWorkspace(scope: ChatScope, intent: LocalIntent) {
  const search = intent.query ? `%${intent.query.slice(0, 220).replace(/[\\%_]/g, "\\$&")}%` : null;
  const where = and(itemScope(scope), intent.status ? eq(workItems.status, intent.status) : undefined,
    intent.reviewDecision ? eq(sql`(select ${reviewDecisions.decision} from ${reviewDecisions} where ${reviewDecisions.agencyId} = ${scope.agencyId} and ${reviewDecisions.workspaceId} = ${scope.workspaceId} and ${reviewDecisions.workItemId} = ${workItems.id} and ${reviewDecisions.versionId} = ${workItems.currentVersionId} order by ${reviewDecisions.decidedAt} desc limit 1)`, intent.reviewDecision) : undefined,
    intent.since ? gte(workItems.updatedAt, intent.since) : undefined,
    search ? or(like(workItems.title, search), like(workItems.description, search), like(divisions.name, search), like(workItems.category, search), like(workItems.subcategory, search)) : undefined);
  const [items, totals, projects] = await Promise.all([
    db.select({ id: workItems.id, title: workItems.title, status: workItems.status, project: divisions.name, currentVersionId: workItems.currentVersionId, updatedAt: workItems.updatedAt })
      .from(workItems).leftJoin(divisions, and(eq(divisions.id, workItems.divisionId), eq(divisions.agencyId, scope.agencyId)))
      .where(where).orderBy(desc(workItems.updatedAt)).limit(30),
    db.select({ status: workItems.status, total: count() }).from(workItems)
      .leftJoin(divisions, and(eq(divisions.id, workItems.divisionId), eq(divisions.agencyId, scope.agencyId)))
      .where(where).groupBy(workItems.status),
    db.select({ name: divisions.name, total: count(workItems.id) }).from(divisions)
      .leftJoin(workItems, and(eq(workItems.divisionId, divisions.id), itemScope(scope)))
      .where(eq(divisions.agencyId, scope.agencyId)).groupBy(divisions.id, divisions.name).orderBy(divisions.name).limit(100),
  ]);
  return { items, totals, projects };
}
export async function getAiWorkItem(scope: ChatScope, itemId: string) {
  const [item] = await db.select().from(workItems).where(and(itemScope(scope), eq(workItems.id, itemId))).limit(1);
  if (!item) throw new Error("NOT_FOUND");
  const [versionRows, reviews, feedback] = await Promise.all([
    db.select({ version: workItemVersions, asset: assets }).from(workItemVersions)
      .innerJoin(workItems, and(eq(workItems.id, workItemVersions.workItemId), itemScope(scope)))
      .leftJoin(versionAssets, and(eq(versionAssets.versionId, workItemVersions.id), eq(versionAssets.agencyId, scope.agencyId), eq(versionAssets.purpose, "PREVIEW")))
      .leftJoin(assets, and(eq(assets.id, versionAssets.assetId), eq(assets.agencyId, scope.agencyId), eq(assets.workspaceId, scope.workspaceId), eq(assets.status, "READY")))
      .where(and(eq(workItemVersions.agencyId, scope.agencyId), eq(workItemVersions.workItemId, item.id), eq(workItemVersions.status, "PUBLISHED")))
      .orderBy(desc(workItemVersions.versionNumber)).limit(100),
    db.select().from(reviewDecisions).where(and(eq(reviewDecisions.agencyId, scope.agencyId), eq(reviewDecisions.workspaceId, scope.workspaceId), eq(reviewDecisions.workItemId, item.id)))
      .orderBy(desc(reviewDecisions.decidedAt)).limit(200),
    db.select({ feedback: feedbackEntries }).from(feedbackEntries)
      .innerJoin(reviewDecisions, and(eq(reviewDecisions.id, feedbackEntries.reviewDecisionId), eq(reviewDecisions.agencyId, scope.agencyId), eq(reviewDecisions.workspaceId, scope.workspaceId), eq(reviewDecisions.workItemId, item.id)))
      .where(and(eq(feedbackEntries.agencyId, scope.agencyId), eq(feedbackEntries.workspaceId, scope.workspaceId), eq(feedbackEntries.visibility, "CLIENT_VISIBLE"))).limit(500),
  ]);
  return { item, versions: versionRows, reviews, feedback: feedback.map(({ feedback: entry }) => entry) };
}
