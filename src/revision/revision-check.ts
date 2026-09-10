import "server-only";

import sharp from "sharp";
import type { RevisionComparisonSource } from "@/data/revision-comparison";
import type { RevisionCheck } from "@/domain/quality-tools";
import { readObject } from "@/storage/filesystem";

const maxComparisonBytes = 45 * 1024 * 1024;
const comparisonWidth = 320;
const comparisonHeight = 320;
const changedChannelThreshold = 20;

type Requirement = RevisionCheck["requirements"][number];
type ImageFacts = {
  beforeWidth: number;
  beforeHeight: number;
  afterWidth: number;
  afterHeight: number;
  changedPercent: number;
  changedRegion: string;
};

export class RevisionComparisonInputError extends Error {}

async function objectBytes(storageKey: string) {
  return Buffer.from(await new Response(await readObject(storageKey)).arrayBuffer());
}

function location(start: number, end: number, total: number, names: [string, string, string]) {
  const center = (start + end) / 2 / total;
  return center < 1 / 3 ? names[0] : center > 2 / 3 ? names[2] : names[1];
}

function regionName(minX: number, maxX: number, minY: number, maxY: number, count: number) {
  const coverage = ((maxX - minX + 1) * (maxY - minY + 1)) / (comparisonWidth * comparisonHeight);
  if (coverage > 0.7 || count / (comparisonWidth * comparisonHeight) > 0.45) return "across most of the design";
  const vertical = location(minY, maxY, comparisonHeight, ["top", "middle", "bottom"]);
  const horizontal = location(minX, maxX, comparisonWidth, ["left", "center", "right"]);
  return vertical === "middle" && horizontal === "center" ? "near the center" : `in the ${vertical}-${horizontal} area`;
}

async function imageFacts(before: Buffer, after: Buffer): Promise<ImageFacts> {
  const [beforeMeta, afterMeta, beforeRaw, afterRaw] = await Promise.all([
    sharp(before).metadata(),
    sharp(after).metadata(),
    sharp(before).flatten({ background: "white" }).resize(comparisonWidth, comparisonHeight, { fit: "fill" }).removeAlpha().raw().toBuffer(),
    sharp(after).flatten({ background: "white" }).resize(comparisonWidth, comparisonHeight, { fit: "fill" }).removeAlpha().raw().toBuffer(),
  ]);
  if (!beforeMeta.width || !beforeMeta.height || !afterMeta.width || !afterMeta.height) {
    throw new RevisionComparisonInputError("One of the images has no readable dimensions.");
  }

  let changed = 0;
  let minX = comparisonWidth;
  let maxX = -1;
  let minY = comparisonHeight;
  let maxY = -1;
  for (let pixel = 0; pixel < comparisonWidth * comparisonHeight; pixel += 1) {
    const offset = pixel * 3;
    const differs = Math.max(
      Math.abs(beforeRaw[offset] - afterRaw[offset]),
      Math.abs(beforeRaw[offset + 1] - afterRaw[offset + 1]),
      Math.abs(beforeRaw[offset + 2] - afterRaw[offset + 2]),
    ) > changedChannelThreshold;
    if (!differs) continue;
    changed += 1;
    const x = pixel % comparisonWidth;
    const y = Math.floor(pixel / comparisonWidth);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  return {
    beforeWidth: beforeMeta.width,
    beforeHeight: beforeMeta.height,
    afterWidth: afterMeta.width,
    afterHeight: afterMeta.height,
    changedPercent: changed / (comparisonWidth * comparisonHeight) * 100,
    changedRegion: changed ? regionName(minX, maxX, minY, maxY, changed) : "nowhere detectable",
  };
}

function byteSize(value: number) {
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} bytes`;
}

function imageFormatFromMime(mimeType: string) {
  return mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1]?.toLowerCase();
}

function requestedFormat(text: string) {
  const match = text.match(/\b(png|jpe?g|pdf|docx?|xlsx?)\b/i);
  return match?.[1].toLowerCase().replace("jpeg", "jpg") ?? null;
}

function actualFormat(mimeType: string) {
  const formats: Record<string, string> = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  };
  return mimeType.startsWith("image/") ? imageFormatFromMime(mimeType) : formats[mimeType] ?? mimeType;
}

function objectiveRequirement(request: string, facts: ImageFacts | null, beforeSize: number, afterSize: number, mimeType: string): Requirement | null {
  const dimensions = request.match(/\b(\d{2,5})\s*[xX\u00d7]\s*(\d{2,5})\b/);
  if (dimensions && facts) {
    const wantedWidth = Number(dimensions[1]);
    const wantedHeight = Number(dimensions[2]);
    const met = facts.afterWidth === wantedWidth && facts.afterHeight === wantedHeight;
    return { request, status: met ? "MET" : "MISSING", evidence: `Requested ${wantedWidth} x ${wantedHeight}px; revised image is ${facts.afterWidth} x ${facts.afterHeight}px.` };
  }

  const lower = request.toLowerCase();
  const orientation = lower.match(/\b(portrait|landscape|square)\b/)?.[1];
  if (orientation && facts) {
    const actual = facts.afterWidth === facts.afterHeight ? "square" : facts.afterWidth > facts.afterHeight ? "landscape" : "portrait";
    return { request, status: actual === orientation ? "MET" : "MISSING", evidence: `Requested ${orientation}; revised image is ${actual} (${facts.afterWidth} x ${facts.afterHeight}px).` };
  }

  const format = requestedFormat(request);
  if (format) {
    const actual = actualFormat(mimeType);
    return { request, status: actual === format ? "MET" : "MISSING", evidence: `Requested ${format.toUpperCase()}; revised file format is ${actual.toUpperCase()}.` };
  }

  const limit = lower.match(/\b(?:under|below|max(?:imum)?|less than)\s*(\d+(?:\.\d+)?)\s*(kb|mb)\b/);
  if (limit) {
    const multiplier = limit[2] === "mb" ? 1024 * 1024 : 1024;
    const maximum = Number(limit[1]) * multiplier;
    return { request, status: afterSize < maximum ? "MET" : "MISSING", evidence: `Requested below ${limit[1]} ${limit[2].toUpperCase()}; revised file is ${byteSize(afterSize)}.` };
  }

  if (/\b(reduce|decrease|compress|smaller)\b.*\bfile\s*size\b|\bfile\s*size\b.*\b(reduce|decrease|compress|smaller)\b/.test(lower)) {
    return { request, status: afterSize < beforeSize ? "MET" : "MISSING", evidence: `File size changed from ${byteSize(beforeSize)} to ${byteSize(afterSize)}.` };
  }

  if (facts && /\b(increase|raise|larger|bigger)\b.*\b(resolution|canvas|image dimensions|poster size)\b/.test(lower)) {
    const beforeArea = facts.beforeWidth * facts.beforeHeight;
    const afterArea = facts.afterWidth * facts.afterHeight;
    return { request, status: afterArea > beforeArea ? "MET" : "MISSING", evidence: `Dimensions changed from ${facts.beforeWidth} x ${facts.beforeHeight}px to ${facts.afterWidth} x ${facts.afterHeight}px.` };
  }

  if (facts && /\b(decrease|reduce|smaller)\b.*\b(resolution|canvas|image dimensions|poster size)\b/.test(lower)) {
    const beforeArea = facts.beforeWidth * facts.beforeHeight;
    const afterArea = facts.afterWidth * facts.afterHeight;
    return { request, status: afterArea < beforeArea ? "MET" : "MISSING", evidence: `Dimensions changed from ${facts.beforeWidth} x ${facts.beforeHeight}px to ${facts.afterWidth} x ${facts.afterHeight}px.` };
  }
  return null;
}

export async function analyzeRevision(source: RevisionComparisonSource): Promise<RevisionCheck> {
  const beforeAsset = source.requestedVersion.asset;
  const afterAsset = source.currentVersion.asset;
  if (beforeAsset.sizeBytes + afterAsset.sizeBytes > maxComparisonBytes) {
    throw new RevisionComparisonInputError("The two versions are too large to check together (45 MB maximum).");
  }

  const [before, after] = await Promise.all([objectBytes(beforeAsset.storageKey), objectBytes(afterAsset.storageKey)]);
  const identical = before.equals(after);
  const bothImages = beforeAsset.mimeType.startsWith("image/") && afterAsset.mimeType.startsWith("image/");
  let facts: ImageFacts | null = null;
  if (bothImages && !identical) {
    try {
      facts = await imageFacts(before, after);
    } catch (error) {
      if (error instanceof RevisionComparisonInputError) throw error;
      throw new RevisionComparisonInputError("One of the uploaded images could not be decoded for comparison.");
    }
  }

  const requirements = source.feedback.map((request): Requirement => {
    if (identical) return { request, status: "MISSING", evidence: "The revised file is byte-for-byte identical to the version that received this request." };
    const objective = objectiveRequirement(request, facts, before.length, after.length, afterAsset.mimeType);
    if (objective) return objective;
    if (facts) return {
      request,
      status: "UNCERTAIN",
      evidence: `${facts.changedPercent.toFixed(1)}% of sampled pixels changed ${facts.changedRegion}; a rule-based comparison cannot identify whether this specific visual or wording request was fulfilled.`,
    };
    return {
      request,
      status: "UNCERTAIN",
      evidence: "The stored files differ, but this rule-based binary check cannot verify the requested content change.",
    };
  });

  const visualChanges: string[] = [];
  if (identical) visualChanges.push("No change: both stored files have exactly the same bytes.");
  else {
    visualChanges.push(`File size changed from ${byteSize(before.length)} to ${byteSize(after.length)}.`);
    if (beforeAsset.mimeType !== afterAsset.mimeType) visualChanges.push(`File type changed from ${beforeAsset.mimeType} to ${afterAsset.mimeType}.`);
    if (facts) {
      if (facts.beforeWidth !== facts.afterWidth || facts.beforeHeight !== facts.afterHeight) {
        visualChanges.push(`Image dimensions changed from ${facts.beforeWidth} x ${facts.beforeHeight}px to ${facts.afterWidth} x ${facts.afterHeight}px.`);
      }
      visualChanges.push(`${facts.changedPercent.toFixed(1)}% of sampled pixels changed ${facts.changedRegion}.`);
    } else visualChanges.push("The file bytes changed; detailed visual comparison is available only when both versions are images.");
  }

  const verdict = requirements.some((item) => item.status === "MISSING")
    ? "NEEDS_ATTENTION"
    : requirements.length > 0 && requirements.every((item) => item.status === "MET")
      ? "READY"
      : "UNCERTAIN";
  const summary = verdict === "READY"
    ? "Every request that can be checked with deterministic rules passed."
    : verdict === "NEEDS_ATTENTION"
      ? "At least one requested change failed an objective check."
      : "The files changed, but one or more requests need human visual confirmation.";

  return {
    verdict,
    summary,
    requirements,
    visualChanges,
    warnings: [
      "This is a deterministic file check, not an AI review.",
      "It can prove exact file, format, size, dimensions, orientation, and pixel changes, but it cannot understand objects, wording, or design intent.",
    ],
    compared: { fromVersion: source.requestedVersion.versionNumber, toVersion: source.currentVersion.versionNumber },
  };
}
