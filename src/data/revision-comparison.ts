import "server-only";

import { and, desc, eq, ne } from "drizzle-orm";
import { withPlatformAdmin } from "@/db/client";
import { agencies, assets, feedbackEntries, reviewDecisions, versionAssets, workItems, workItemVersions } from "@/db/schema";

export interface RevisionComparisonAsset {
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface RevisionComparisonSource {
  posterId: string;
  title: string;
  requestedVersion: { versionNumber: number; note: string; asset: RevisionComparisonAsset };
  currentVersion: { versionNumber: number; note: string; asset: RevisionComparisonAsset };
  feedback: string[];
}

export async function getRevisionComparisonSource(posterId: string): Promise<RevisionComparisonSource | null> {
  const rows = await withPlatformAdmin((transaction) => transaction
    .select({
      posterId: workItems.id,
      title: workItems.title,
      currentVersionId: workItems.currentVersionId,
      versionId: workItemVersions.id,
      versionNumber: workItemVersions.versionNumber,
      versionNote: workItemVersions.note,
      assetStorageKey: assets.storageKey,
      assetOriginalName: assets.originalName,
      assetMimeType: assets.detectedMimeType,
      assetSizeBytes: assets.sizeBytes,
      reviewId: reviewDecisions.id,
      reviewDecision: reviewDecisions.decision,
      feedbackText: feedbackEntries.textContent,
    })
    .from(workItems)
    .innerJoin(agencies, and(eq(agencies.id, workItems.agencyId), eq(agencies.status, "ACTIVE")))
    .innerJoin(workItemVersions, and(
      eq(workItemVersions.agencyId, workItems.agencyId),
      eq(workItemVersions.workItemId, workItems.id),
      eq(workItemVersions.status, "PUBLISHED"),
    ))
    .innerJoin(versionAssets, and(
      eq(versionAssets.agencyId, workItems.agencyId),
      eq(versionAssets.versionId, workItemVersions.id),
      eq(versionAssets.purpose, "PREVIEW"),
    ))
    .innerJoin(assets, and(
      eq(assets.agencyId, workItems.agencyId),
      eq(assets.id, versionAssets.assetId),
      eq(assets.status, "READY"),
    ))
    .leftJoin(reviewDecisions, and(
      eq(reviewDecisions.agencyId, workItems.agencyId),
      eq(reviewDecisions.versionId, workItemVersions.id),
    ))
    .leftJoin(feedbackEntries, and(
      eq(feedbackEntries.agencyId, workItems.agencyId),
      eq(feedbackEntries.reviewDecisionId, reviewDecisions.id),
      eq(feedbackEntries.visibility, "CLIENT_VISIBLE"),
      eq(feedbackEntries.kind, "TEXT"),
    ))
    .where(and(eq(workItems.id, posterId), ne(workItems.status, "ARCHIVED")))
    .orderBy(desc(workItemVersions.versionNumber), desc(reviewDecisions.decidedAt)));

  const first = rows[0];
  if (!first?.currentVersionId) return null;
  type Version = {
    id: string;
    versionNumber: number;
    note: string;
    asset: RevisionComparisonAsset;
    requested: boolean;
    feedback: string[];
  };
  const versions = new Map<string, Version>();
  for (const row of rows) {
    if (!row.assetMimeType || row.assetSizeBytes == null) continue;
    let version = versions.get(row.versionId);
    if (!version) {
      version = {
        id: row.versionId,
        versionNumber: row.versionNumber,
        note: row.versionNote ?? "",
        asset: {
          storageKey: row.assetStorageKey,
          originalName: row.assetOriginalName,
          mimeType: row.assetMimeType,
          sizeBytes: Number(row.assetSizeBytes),
        },
        requested: false,
        feedback: [],
      };
      versions.set(row.versionId, version);
    }
    if (row.reviewDecision === "REQUEST_CHANGES" || row.reviewDecision === "REJECT") version.requested = true;
    const feedback = row.feedbackText?.trim();
    if (feedback && !version.feedback.includes(feedback)) version.feedback.push(feedback);
  }

  const ordered = [...versions.values()].sort((a, b) => b.versionNumber - a.versionNumber);
  const current = ordered.find((version) => version.id === first.currentVersionId);
  // A change request on the current version needs a newer upload before it can
  // be checked; comparing it against an older request would be misleading.
  if (!current || current.requested) return null;
  const requested = ordered.find((version) => version.versionNumber < current.versionNumber && version.requested && version.feedback.length);
  if (!requested) return null;
  return {
    posterId: first.posterId,
    title: first.title,
    requestedVersion: { versionNumber: requested.versionNumber, note: requested.note, asset: requested.asset },
    currentVersion: { versionNumber: current.versionNumber, note: current.note, asset: current.asset },
    feedback: requested.feedback,
  };
}
