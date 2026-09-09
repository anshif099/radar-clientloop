import "server-only";
import { and, count, desc, eq, gte, like, ne, or, sql } from "drizzle-orm";
import { db, withPlatformAdmin } from "@/db/client";
import { agencies, assets, divisions, feedbackEntries, reviewDecisions, versionAssets, workItems, workItemVersions } from "@/db/schema";
import type { ChatScope } from "./chat";

function itemScope(scope: ChatScope) {
  if (!scope.agencyId || !scope.workspaceId) throw new Error("FORBIDDEN");
  return and(eq(workItems.agencyId, scope.agencyId), eq(workItems.workspaceId, scope.workspaceId), ne(workItems.status, "ARCHIVED"), ne(workItems.status, "DRAFT"));
}
export async function getAiCompanyOverview(scope: ChatScope) {
  if (scope.role !== "ADMIN") {
    return { total: 1, companies: [{ id: scope.agencyId, name: scope.companyName }] };
  }
  return withPlatformAdmin(async (transaction) => {
    const [totals, companies] = await Promise.all([
      transaction.select({ total: count() }).from(agencies).where(eq(agencies.status, "ACTIVE")),
      transaction.select({ id: agencies.id, name: agencies.name }).from(agencies)
        .where(eq(agencies.status, "ACTIVE")).orderBy(agencies.name).limit(100),
    ]);
    return { total: Number(totals[0]?.total ?? 0), companies };
  });
}
export interface AiWorkspaceFilter {
  query: string;
  status?: "APPROVED" | "AWAITING_CLIENT_REVIEW" | "REVISION_REQUIRED";
  reviewDecision?: "REQUEST_CHANGES" | "REJECT";
  since?: Date;
}
export async function searchAiWorkspace(scope: ChatScope, filter: AiWorkspaceFilter) {
  const search = filter.query ? `%${filter.query.slice(0, 220).replace(/[\\%_]/g, "\\$&")}%` : null;
  const where = and(itemScope(scope), filter.status ? eq(workItems.status, filter.status) : undefined,
    filter.reviewDecision ? eq(sql`(select ${reviewDecisions.decision} from ${reviewDecisions} where ${reviewDecisions.agencyId} = ${scope.agencyId} and ${reviewDecisions.workspaceId} = ${scope.workspaceId} and ${reviewDecisions.workItemId} = ${workItems.id} and ${reviewDecisions.versionId} = ${workItems.currentVersionId} order by ${reviewDecisions.decidedAt} desc limit 1)`, filter.reviewDecision) : undefined,
    filter.since ? gte(workItems.updatedAt, filter.since) : undefined,
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

function clip(value: string | null, length = 500) {
  if (!value) return null;
  return value.length > length ? `${value.slice(0, length)}…` : value;
}

const applicationGuide = {
  purpose: "ClientLoop is a content review portal where an agency and its clients manage projects, published creative work, revisions, feedback, and approvals.",
  roles: [
    "Admins can manage companies and projects, upload and publish work, review progress, and talk with clients.",
    "Company users can access only their own company workspace, review published work, give feedback, request changes, approve or reject versions, download files, and use company chat.",
  ],
  workflow: [
    "An admin creates a company and project, uploads a poster or other supported content, and publishes a version for client review.",
    "The client reviews the current published version and can approve it, request changes, or reject it with feedback.",
    "A revised upload creates another version, preserving the earlier versions and review history.",
  ],
  content: "Supported content includes images, videos, PDFs, Word and Excel documents, and website links. Categories and subcategories help organize work.",
  conversations: "Company chat is shared between the agency and that company. AI Ultra conversations are private to the signed-in user and scoped to the selected company.",
  ai: "AI Ultra runs an open-source language model in the user's browser. It prefers WebGPU and automatically uses a private CPU/WASM model when no compatible GPU is available. It can explain ClientLoop, answer from authorized workspace facts, summarize progress, discuss feedback and version history, and use a selected post as context. It cannot change records or reliably inspect pixels, document pages, audio, or video content.",
  privacy: "Authentication, authorization, and database retrieval happen on the ClientLoop server. The browser model receives bounded authorized context without passwords, tokens, private storage paths, checksums, or internal-only feedback.",
  statusMeaning: {
    APPROVED: "The client approved the current published version.",
    AWAITING_CLIENT_REVIEW: "The current published version is waiting for the client's decision.",
    REVISION_REQUIRED: "The client requested changes or rejected the current version.",
  },
};

/**
 * A deliberately bounded, authorization-scoped view of ClientLoop data for the
 * in-browser model. Never expose storage keys, checksums, internal feedback, or
 * authentication records here.
 */
export async function getBrowserAiGrounding(scope: ChatScope, selectedWorkItemId?: string) {
  const [companyOverview, posts, statusTotals, projects, recentVersions, recentFeedback, selected] = await Promise.all([
    getAiCompanyOverview(scope),
    db.select({
      id: workItems.id,
      title: workItems.title,
      description: workItems.description,
      category: workItems.category,
      subcategory: workItems.subcategory,
      status: workItems.status,
      project: divisions.name,
      firstPublishedAt: workItems.firstPublishedAt,
      approvedAt: workItems.approvedAt,
      createdAt: workItems.createdAt,
      updatedAt: workItems.updatedAt,
    }).from(workItems)
      .leftJoin(divisions, and(eq(divisions.id, workItems.divisionId), eq(divisions.agencyId, scope.agencyId)))
      .where(itemScope(scope)).orderBy(desc(workItems.updatedAt)).limit(30),
    db.select({ status: workItems.status, total: count() }).from(workItems)
      .where(itemScope(scope)).groupBy(workItems.status),
    db.select({ name: divisions.name, postCount: count(workItems.id) }).from(divisions)
      .leftJoin(workItems, and(eq(workItems.divisionId, divisions.id), itemScope(scope)))
      .where(eq(divisions.agencyId, scope.agencyId))
      .groupBy(divisions.id, divisions.name).orderBy(divisions.name).limit(100),
    db.select({
      postTitle: workItems.title,
      versionNumber: workItemVersions.versionNumber,
      note: workItemVersions.note,
      publishedAt: workItemVersions.publishedAt,
      createdAt: workItemVersions.createdAt,
    }).from(workItemVersions)
      .innerJoin(workItems, and(eq(workItems.id, workItemVersions.workItemId), itemScope(scope)))
      .where(and(eq(workItemVersions.agencyId, scope.agencyId), eq(workItemVersions.status, "PUBLISHED")))
      .orderBy(desc(workItemVersions.publishedAt)).limit(20),
    db.select({
      postTitle: workItems.title,
      decision: reviewDecisions.decision,
      reviewer: reviewDecisions.reviewerLabel,
      decidedAt: reviewDecisions.decidedAt,
      kind: feedbackEntries.kind,
      text: feedbackEntries.textContent,
      referenceUrl: feedbackEntries.referenceUrl,
    }).from(feedbackEntries)
      .innerJoin(reviewDecisions, and(
        eq(reviewDecisions.id, feedbackEntries.reviewDecisionId),
        eq(reviewDecisions.agencyId, scope.agencyId),
        eq(reviewDecisions.workspaceId, scope.workspaceId),
      ))
      .innerJoin(workItems, and(eq(workItems.id, reviewDecisions.workItemId), itemScope(scope)))
      .where(and(
        eq(feedbackEntries.agencyId, scope.agencyId),
        eq(feedbackEntries.workspaceId, scope.workspaceId),
        eq(feedbackEntries.visibility, "CLIENT_VISIBLE"),
      )).orderBy(desc(feedbackEntries.createdAt)).limit(15),
    selectedWorkItemId ? getAiWorkItem(scope, selectedWorkItemId) : Promise.resolve(null),
  ]);

  const selectedPost = selected ? {
    id: selected.item.id,
    title: selected.item.title,
    description: clip(selected.item.description, 800),
    category: selected.item.category,
    subcategory: selected.item.subcategory,
    status: selected.item.status,
    firstPublishedAt: selected.item.firstPublishedAt,
    approvedAt: selected.item.approvedAt,
    createdAt: selected.item.createdAt,
    updatedAt: selected.item.updatedAt,
    versions: selected.versions.slice(0, 12).map(({ version, asset }) => ({
      versionNumber: version.versionNumber,
      status: version.status,
      note: clip(version.note),
      publishedAt: version.publishedAt,
      createdAt: version.createdAt,
      file: asset ? { name: asset.originalName, mimeType: asset.detectedMimeType ?? asset.declaredMimeType, sizeBytes: asset.sizeBytes } : null,
    })),
    reviews: selected.reviews.slice(0, 15).map((review) => ({
      versionId: review.versionId,
      decision: review.decision,
      reviewer: review.reviewerLabel,
      decidedAt: review.decidedAt,
    })),
    feedback: selected.feedback.slice(0, 15).map((entry) => ({
      kind: entry.kind,
      text: clip(entry.textContent, 800),
      referenceUrl: entry.referenceUrl,
      createdAt: entry.createdAt,
    })),
  } : null;

  return {
    generatedAt: new Date().toISOString(),
    applicationGuide,
    access: { role: scope.role, selectedCompany: scope.companyName },
    companies: {
      total: companyOverview.total,
      visible: companyOverview.companies,
      truncated: companyOverview.companies.length < companyOverview.total,
    },
    workspace: {
      statusTotals: Object.fromEntries(statusTotals.map((entry) => [entry.status, Number(entry.total)])),
      projects: projects.map((entry) => ({ name: entry.name, postCount: Number(entry.postCount) })),
      recentPosts: posts.map((post) => ({ ...post, description: clip(post.description) })),
      recentPublishedVersions: recentVersions.map((version) => ({ ...version, note: clip(version.note) })),
      recentClientVisibleFeedback: recentFeedback.map((entry) => ({ ...entry, text: clip(entry.text, 800) })),
      limits: {
        recentPosts: 30,
        recentPublishedVersions: 20,
        recentClientVisibleFeedback: 15,
        note: "Counts are complete; detail lists contain the most recent records only.",
      },
    },
    selectedPost,
  };
}
