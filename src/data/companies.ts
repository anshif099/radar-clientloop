import "server-only";

import { and, count, desc, eq } from "drizzle-orm";
import { auth } from "@/auth/server";
import { authSessions, authUsers } from "@/db/auth-schema";
import { db, withAgency, withPlatformAdmin } from "@/db/client";
import {
  agencies,
  agencyMemberships,
  assets,
  auditEvents,
  clientWorkspaces,
  divisions,
  feedbackEntries,
  outboxEvents,
  reviewDecisions,
  users,
  versionAssets,
  workItems,
  workItemVersions,
  workspaceMemberships,
} from "@/db/schema";
import { toSlug } from "@/lib/slug";

export interface CompanyContext {
  agencyId: string;
  agencyName: string;
  workspaceId: string;
  workspaceName: string;
  profileUserId: string;
  displayName: string;
}

export interface CompanySummary {
  id: string;
  name: string;
  slug: string;
  email: string;
  posterCount: number;
  createdAt: Date;
}

export interface ProjectSummary {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  posterCount: number;
  createdAt: Date;
}

export interface CompanyPoster {
  id: string;
  title: string;
  project: string;
  publishedAt: string;
  version: number;
  decision: "pending" | "approved" | "changes" | "rejected";
  preview: string;
  comments: number;
  note: string;
}

export async function listCompaniesForAdmin(): Promise<CompanySummary[]> {
  return withPlatformAdmin(async (transaction) => {
    const rows = await transaction
      .select({
        id: agencies.id,
        name: agencies.name,
        slug: agencies.slug,
        email: users.email,
        posterCount: count(workItems.id),
        createdAt: agencies.createdAt,
      })
      .from(agencies)
      .innerJoin(
        agencyMemberships,
        and(eq(agencyMemberships.agencyId, agencies.id), eq(agencyMemberships.role, "ADMIN")),
      )
      .innerJoin(users, eq(users.id, agencyMemberships.userId))
      .leftJoin(workItems, eq(workItems.agencyId, agencies.id))
      .where(eq(agencies.status, "ACTIVE"))
      .groupBy(agencies.id, users.email)
      .orderBy(desc(agencies.createdAt));

    return rows.map((row) => ({ ...row, posterCount: Number(row.posterCount) }));
  });
}

export async function getCompanyContextForIdentity(identityProviderId: string) {
  const matches = await withPlatformAdmin((transaction) =>
    transaction
      .select({
        agencyId: agencies.id,
        agencyName: agencies.name,
        workspaceId: clientWorkspaces.id,
        workspaceName: clientWorkspaces.name,
        profileUserId: users.id,
        displayName: users.displayName,
      })
      .from(users)
      .innerJoin(
        agencyMemberships,
        and(eq(agencyMemberships.userId, users.id), eq(agencyMemberships.status, "ACTIVE")),
      )
      .innerJoin(
        agencies,
        and(eq(agencies.id, agencyMemberships.agencyId), eq(agencies.status, "ACTIVE")),
      )
      .innerJoin(
        clientWorkspaces,
        and(
          eq(clientWorkspaces.agencyId, agencies.id),
          eq(clientWorkspaces.status, "ACTIVE"),
        ),
      )
      .where(eq(users.identityProviderId, identityProviderId))
      .limit(2),
  );

  if (matches.length !== 1) return null;
  return matches[0] satisfies CompanyContext;
}

async function uniqueAgencySlug(name: string) {
  const base = toSlug(name);
  return withPlatformAdmin(async (transaction) => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const suffix = attempt === 0 ? "" : `-${crypto.randomUUID().slice(0, 6)}`;
      const candidate = `${base.slice(0, 64 - suffix.length)}${suffix}`;
      const existing = await transaction
        .select({ id: agencies.id })
        .from(agencies)
        .where(eq(agencies.slug, candidate))
        .limit(1);
      if (!existing[0]) return candidate;
    }
    throw new Error("Could not create a unique company slug.");
  });
}

export async function createCompany(input: { name: string; email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const slug = await uniqueAgencySlug(input.name);
  const createdAuth = await auth.api.createUser({
    body: {
      name: `${input.name.trim()} Admin`,
      email,
      password: input.password,
      role: "user",
    },
  });

  try {
    const company = await withPlatformAdmin(async (transaction) => {
      const [agency] = await transaction
        .insert(agencies)
        .values({ name: input.name.trim(), slug })
        .returning();
      const [profile] = await transaction
        .insert(users)
        .values({
          identityProviderId: createdAuth.user.id,
          email: createdAuth.user.email,
          displayName: createdAuth.user.name,
        })
        .returning();
      const [workspace] = await transaction
        .insert(clientWorkspaces)
        .values({ agencyId: agency.id, name: agency.name, slug: "review" })
        .returning();

      await transaction.insert(agencyMemberships).values({
        agencyId: agency.id,
        userId: profile.id,
        role: "ADMIN",
        status: "ACTIVE",
      });
      await transaction.insert(workspaceMemberships).values({
        agencyId: agency.id,
        workspaceId: workspace.id,
        userId: profile.id,
        canViewAllItems: true,
      });
      await transaction.insert(auditEvents).values({
        agencyId: agency.id,
        workspaceId: workspace.id,
        actorType: "SUPER_ADMIN",
        actorId: createdAuth.user.id,
        action: "COMPANY_CREATED",
        resourceType: "AGENCY",
        resourceId: agency.id,
        metadata: { companyLoginEmail: email },
      });
      return { id: agency.id, name: agency.name, slug: agency.slug, email };
    });
    return company;
  } catch (error) {
    await db.delete(authUsers).where(eq(authUsers.id, createdAuth.user.id));
    throw error;
  }
}

export async function updateCompany(input: {
  companyId: string;
  name: string;
  email: string;
  actorId: string;
}) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  return withPlatformAdmin(async (transaction) => {
    const [company] = await transaction
      .select({
        id: agencies.id,
        slug: agencies.slug,
        profileId: users.id,
        identityProviderId: users.identityProviderId,
      })
      .from(agencies)
      .innerJoin(
        agencyMemberships,
        and(eq(agencyMemberships.agencyId, agencies.id), eq(agencyMemberships.role, "ADMIN")),
      )
      .innerJoin(users, eq(users.id, agencyMemberships.userId))
      .where(and(eq(agencies.id, input.companyId), eq(agencies.status, "ACTIVE")))
      .limit(1);

    if (!company) throw new Error("COMPANY_NOT_FOUND");

    const now = new Date();
    await transaction
      .update(agencies)
      .set({ name, updatedAt: now })
      .where(eq(agencies.id, company.id));
    await transaction
      .update(clientWorkspaces)
      .set({ name, updatedAt: now })
      .where(eq(clientWorkspaces.agencyId, company.id));
    await transaction
      .update(users)
      .set({ email, displayName: `${name} Admin`, updatedAt: now })
      .where(eq(users.id, company.profileId));
    await transaction
      .update(authUsers)
      .set({ email, name: `${name} Admin`, updatedAt: now })
      .where(eq(authUsers.id, company.identityProviderId));
    await transaction.insert(auditEvents).values({
      agencyId: company.id,
      actorType: "SUPER_ADMIN",
      actorId: input.actorId,
      action: "COMPANY_UPDATED",
      resourceType: "AGENCY",
      resourceId: company.id,
      metadata: { companyLoginEmail: email },
    });

    return {
      id: company.id,
      name,
      slug: company.slug,
      email,
      authUserId: company.identityProviderId,
    };
  });
}

export async function deleteCompany(input: { companyId: string; actorId: string }) {
  return withPlatformAdmin(async (transaction) => {
    const [company] = await transaction
      .select({
        id: agencies.id,
        name: agencies.name,
        identityProviderId: users.identityProviderId,
      })
      .from(agencies)
      .innerJoin(
        agencyMemberships,
        and(eq(agencyMemberships.agencyId, agencies.id), eq(agencyMemberships.role, "ADMIN")),
      )
      .innerJoin(users, eq(users.id, agencyMemberships.userId))
      .where(and(eq(agencies.id, input.companyId), eq(agencies.status, "ACTIVE")))
      .limit(1);

    if (!company) throw new Error("COMPANY_NOT_FOUND");

    await transaction.insert(auditEvents).values({
      agencyId: company.id,
      actorType: "SUPER_ADMIN",
      actorId: input.actorId,
      action: "COMPANY_DELETED",
      resourceType: "AGENCY",
      resourceId: company.id,
      metadata: { companyName: company.name, deletionMode: "soft" },
    });

    const now = new Date();
    await transaction
      .update(agencyMemberships)
      .set({ status: "DISABLED", updatedAt: now })
      .where(eq(agencyMemberships.agencyId, company.id));
    await transaction
      .update(clientWorkspaces)
      .set({ status: "ARCHIVED", updatedAt: now })
      .where(eq(clientWorkspaces.agencyId, company.id));
    await transaction
      .update(agencies)
      .set({ status: "CLOSED", updatedAt: now })
      .where(eq(agencies.id, company.id));
    await transaction
      .update(authUsers)
      .set({ banned: true, banReason: "Company deleted", updatedAt: now })
      .where(eq(authUsers.id, company.identityProviderId));
    await transaction.delete(authSessions).where(eq(authSessions.userId, company.identityProviderId));

    return { id: company.id };
  });
}

export async function listProjectsForAdmin(): Promise<ProjectSummary[]> {
  return withPlatformAdmin(async (transaction) => {
    const rows = await transaction
      .select({
        id: divisions.id,
        companyId: divisions.agencyId,
        name: divisions.name,
        slug: divisions.slug,
        posterCount: count(workItems.id),
        createdAt: divisions.createdAt,
      })
      .from(divisions)
      .innerJoin(agencies, eq(agencies.id, divisions.agencyId))
      .leftJoin(
        workItems,
        and(eq(workItems.agencyId, divisions.agencyId), eq(workItems.divisionId, divisions.id)),
      )
      .where(eq(agencies.status, "ACTIVE"))
      .groupBy(divisions.id)
      .orderBy(desc(divisions.createdAt));

    return rows.map((row) => ({ ...row, posterCount: Number(row.posterCount) }));
  });
}

export async function createProject(input: { companyId: string; name: string; actorId: string }) {
  return withPlatformAdmin(async (transaction) => {
    const [company] = await transaction
      .select({ id: agencies.id, workspaceId: clientWorkspaces.id })
      .from(agencies)
      .innerJoin(clientWorkspaces, eq(clientWorkspaces.agencyId, agencies.id))
      .where(and(eq(agencies.id, input.companyId), eq(agencies.status, "ACTIVE")))
      .limit(1);

    if (!company) throw new Error("COMPANY_NOT_FOUND");

    const name = input.name.trim();
    const slug = toSlug(name);
    const [existing] = await transaction
      .select({ id: divisions.id })
      .from(divisions)
      .where(and(eq(divisions.agencyId, company.id), eq(divisions.slug, slug)))
      .limit(1);
    if (existing) throw new Error("PROJECT_EXISTS");

    const [project] = await transaction
      .insert(divisions)
      .values({ agencyId: company.id, name, slug })
      .returning();
    await transaction.insert(auditEvents).values({
      agencyId: company.id,
      workspaceId: company.workspaceId,
      actorType: "SUPER_ADMIN",
      actorId: input.actorId,
      action: "PROJECT_CREATED",
      resourceType: "DIVISION",
      resourceId: project.id,
      metadata: { projectName: project.name },
    });

    return {
      id: project.id,
      companyId: project.agencyId,
      name: project.name,
      slug: project.slug,
    };
  });
}

export async function getProjectForAdmin(companyId: string, projectId: string) {
  const result = await withPlatformAdmin((transaction) =>
    transaction
      .select({ id: divisions.id, name: divisions.name })
      .from(divisions)
      .innerJoin(agencies, eq(agencies.id, divisions.agencyId))
      .where(
        and(
          eq(divisions.id, projectId),
          eq(divisions.agencyId, companyId),
          eq(agencies.status, "ACTIVE"),
        ),
      )
      .limit(1),
  );
  return result[0] ?? null;
}

export async function getCompanyForAdmin(companyId: string) {
  const result = await withPlatformAdmin((transaction) =>
    transaction
      .select({
        id: agencies.id,
        name: agencies.name,
        workspaceId: clientWorkspaces.id,
      })
      .from(agencies)
      .innerJoin(clientWorkspaces, eq(clientWorkspaces.agencyId, agencies.id))
      .where(and(eq(agencies.id, companyId), eq(agencies.status, "ACTIVE")))
      .limit(1),
  );
  return result[0] ?? null;
}

export async function createPoster(input: {
  companyId: string;
  workspaceId: string;
  projectId: string;
  title: string;
  note: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  actorId: string;
}) {
  return withPlatformAdmin(async (transaction) => {
    const [project] = await transaction
      .select({ id: divisions.id })
      .from(divisions)
      .where(and(eq(divisions.agencyId, input.companyId), eq(divisions.id, input.projectId)))
      .limit(1);
    if (!project) throw new Error("PROJECT_NOT_FOUND");

    const [asset] = await transaction
      .insert(assets)
      .values({
        agencyId: input.companyId,
        workspaceId: input.workspaceId,
        storageKey: input.storageKey,
        originalName: input.originalName,
        declaredMimeType: input.mimeType,
        detectedMimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        status: "READY",
      })
      .returning();
    const now = new Date();
    const [item] = await transaction
      .insert(workItems)
      .values({
        agencyId: input.companyId,
        workspaceId: input.workspaceId,
        divisionId: project.id,
        title: input.title,
        description: input.note || null,
        status: "AWAITING_CLIENT_REVIEW",
        firstPublishedAt: now,
      })
      .returning();
    const [version] = await transaction
      .insert(workItemVersions)
      .values({
        agencyId: input.companyId,
        workItemId: item.id,
        versionNumber: 1,
        status: "PUBLISHED",
        note: input.note || null,
        publishedAt: now,
      })
      .returning();
    await transaction.insert(versionAssets).values({
      agencyId: input.companyId,
      versionId: version.id,
      assetId: asset.id,
      purpose: "PREVIEW",
    });
    await transaction
      .update(workItems)
      .set({ currentVersionId: version.id, updatedAt: now })
      .where(and(eq(workItems.agencyId, input.companyId), eq(workItems.id, item.id)));
    await transaction.insert(auditEvents).values({
      agencyId: input.companyId,
      workspaceId: input.workspaceId,
      actorType: "SUPER_ADMIN",
      actorId: input.actorId,
      action: "POSTER_PUBLISHED",
      resourceType: "WORK_ITEM",
      resourceId: item.id,
      metadata: { version: 1, assetId: asset.id, projectId: project.id },
    });
    await transaction.insert(outboxEvents).values({
      agencyId: input.companyId,
      eventType: "POSTER_PUBLISHED",
      aggregateType: "WORK_ITEM",
      aggregateId: item.id,
      payload: { workspaceId: input.workspaceId, versionId: version.id, projectId: project.id },
    });
    return { id: item.id, assetId: asset.id };
  });
}

function itemDecision(status: typeof workItems.$inferSelect.status): CompanyPoster["decision"] {
  if (status === "APPROVED") return "approved";
  if (status === "REVISION_REQUIRED") return "changes";
  return "pending";
}

export async function listCompanyPosters(context: CompanyContext): Promise<CompanyPoster[]> {
  return withAgency(context.agencyId, async (transaction) => {
    const rows = await transaction
      .select({
        id: workItems.id,
        title: workItems.title,
        project: divisions.name,
        publishedAt: workItemVersions.publishedAt,
        version: workItemVersions.versionNumber,
        status: workItems.status,
        assetId: assets.id,
        note: workItemVersions.note,
        comments: count(reviewDecisions.id),
      })
      .from(workItems)
      .innerJoin(
        workItemVersions,
        and(
          eq(workItemVersions.agencyId, workItems.agencyId),
          eq(workItemVersions.id, workItems.currentVersionId),
        ),
      )
      .innerJoin(
        versionAssets,
        and(
          eq(versionAssets.agencyId, workItems.agencyId),
          eq(versionAssets.versionId, workItemVersions.id),
        ),
      )
      .innerJoin(
        assets,
        and(eq(assets.agencyId, workItems.agencyId), eq(assets.id, versionAssets.assetId)),
      )
      .leftJoin(
        divisions,
        and(eq(divisions.agencyId, workItems.agencyId), eq(divisions.id, workItems.divisionId)),
      )
      .leftJoin(
        reviewDecisions,
        and(
          eq(reviewDecisions.agencyId, workItems.agencyId),
          eq(reviewDecisions.workItemId, workItems.id),
        ),
      )
      .where(
        and(
          eq(workItems.agencyId, context.agencyId),
          eq(workItems.workspaceId, context.workspaceId),
          eq(assets.status, "READY"),
        ),
      )
      .groupBy(
        workItems.id,
        divisions.name,
        workItemVersions.publishedAt,
        workItemVersions.versionNumber,
        assets.id,
        workItemVersions.note,
      )
      .orderBy(desc(workItemVersions.publishedAt));

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      project: row.project ?? "Unassigned",
      publishedAt: (row.publishedAt ?? new Date()).toISOString(),
      version: row.version,
      decision: itemDecision(row.status),
      preview: `/api/v1/company/assets/${row.assetId}`,
      comments: Number(row.comments),
      note: row.note ?? "",
    }));
  });
}

export async function recordCompanyDecision(input: {
  context: CompanyContext;
  itemId: string;
  decision: "APPROVE" | "REQUEST_CHANGES" | "REJECT";
  feedback?: string;
  idempotencyKey: string;
  authUserId: string;
}) {
  return withAgency(input.context.agencyId, async (transaction) => {
    const [item] = await transaction
      .select()
      .from(workItems)
      .where(
        and(
          eq(workItems.agencyId, input.context.agencyId),
          eq(workItems.workspaceId, input.context.workspaceId),
          eq(workItems.id, input.itemId),
        ),
      )
      .limit(1);
    if (!item?.currentVersionId || item.status === "ARCHIVED") throw new Error("NOT_FOUND");
    if (item.status !== "AWAITING_CLIENT_REVIEW") throw new Error("NOT_REVIEWABLE");

    const [review] = await transaction
      .insert(reviewDecisions)
      .values({
        agencyId: input.context.agencyId,
        workspaceId: input.context.workspaceId,
        workItemId: item.id,
        versionId: item.currentVersionId,
        decision: input.decision,
        reviewerLabel: input.context.displayName,
        idempotencyKey: input.idempotencyKey,
      })
      .returning();

    if (input.feedback?.trim()) {
      await transaction.insert(feedbackEntries).values({
        agencyId: input.context.agencyId,
        workspaceId: input.context.workspaceId,
        reviewDecisionId: review.id,
        kind: "TEXT",
        textContent: input.feedback.trim(),
      });
    }

    const status = input.decision === "APPROVE" ? "APPROVED" : "REVISION_REQUIRED";
    await transaction
      .update(workItems)
      .set({
        status,
        approvedAt: input.decision === "APPROVE" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(workItems.agencyId, input.context.agencyId), eq(workItems.id, item.id)));
    await transaction.insert(auditEvents).values({
      agencyId: input.context.agencyId,
      workspaceId: input.context.workspaceId,
      actorType: "COMPANY_USER",
      actorId: input.authUserId,
      action: `REVIEW_${input.decision}`,
      resourceType: "WORK_ITEM",
      resourceId: item.id,
      metadata: { versionId: item.currentVersionId, reviewDecisionId: review.id },
    });
    await transaction.insert(outboxEvents).values({
      agencyId: input.context.agencyId,
      eventType: `REVIEW_${input.decision}`,
      aggregateType: "WORK_ITEM",
      aggregateId: item.id,
      payload: { workspaceId: input.context.workspaceId, reviewDecisionId: review.id },
    });
    return { status };
  });
}

export async function getCompanyAsset(context: CompanyContext, assetId: string) {
  const result = await withAgency(context.agencyId, (transaction) =>
    transaction
      .select({
        storageKey: assets.storageKey,
        originalName: assets.originalName,
        mimeType: assets.detectedMimeType,
      })
      .from(assets)
      .where(
        and(
          eq(assets.agencyId, context.agencyId),
          eq(assets.workspaceId, context.workspaceId),
          eq(assets.id, assetId),
          eq(assets.status, "READY"),
        ),
      )
      .limit(1),
  );
  return result[0] ?? null;
}
