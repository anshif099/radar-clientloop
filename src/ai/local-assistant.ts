import "server-only";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { getAiWorkItem, searchAiWorkspace } from "@/data/ai";
import type { ChatScope } from "@/data/chat";
import { checkRevisionRequirements, interpretQuestion } from "@/domain/local-ai";
import { objectSize, readObject } from "@/storage/filesystem";

const help = "I’m ClientLoop AI Ultra, your locally coded workspace assistant. I can search your company’s database, summarize post status, list projects, show client feedback, and compare uploaded versions.\n\nTry:\n• How many posts are pending?\n• Show approved posts this month\n• Find posts about \"summer\"\n• List projects\n• Select a post and ask: Check the latest version against the client’s requested changes.\n\nI do not use external AI, models, or APIs. I cannot answer arbitrary general-knowledge questions or reliably understand text inside images, PDF pages, video, or voice. I report those checks as needing human review.";
const statusLabel: Record<string, string> = { APPROVED: "approved", AWAITING_CLIENT_REVIEW: "awaiting review", REVISION_REQUIRED: "needing changes / rejected" };
type Reply = { body: string; metadata: Record<string, unknown> };

async function inspectFile(asset: { storageKey: string; detectedMimeType: string | null }) {
  const size = await objectSize(asset.storageKey);
  if (size > 100 * 1024 * 1024) throw new Error("File exceeds analysis limit");
  const hash = createHash("sha256");
  const reader = (await readObject(asset.storageKey)).getReader();
  const chunks: Uint8Array[] = [];
  const image = Boolean(asset.detectedMimeType?.startsWith("image/")) && size <= 20 * 1024 * 1024;
  let read = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      read += value.length;
      if (read > 100 * 1024 * 1024) throw new Error("File exceeds analysis limit");
      hash.update(value);
      if (image) chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const checksum = hash.digest("hex");
  if (!image) return { size, checksum };
  const bytes = Buffer.concat(chunks);
  try {
    const pipeline = sharp(bytes, { limitInputPixels: 40_000_000 }).timeout({ seconds: 8 });
    const metadata = await pipeline.metadata();
    const pixels = await pipeline.rotate().resize(128, 128, { fit: "fill" }).flatten({ background: "#fff" }).removeAlpha().toColourspace("srgb").raw().toBuffer();
    return { size, checksum, width: metadata.width, height: metadata.height, pixels, animated: (metadata.pages ?? 1) > 1 };
  } catch { return { size, checksum, imageError: true }; }
}
async function reviewItem(scope: ChatScope, itemId: string, question: string): Promise<Reply> {
  const data = await getAiWorkItem(scope, itemId);
  const requestedVersions = [...question.matchAll(/\b(?:v|version\s*)(\d+)\b/gi)].map((match) => Number(match[1])).sort((a, b) => b - a);
  const requestedVersion = requestedVersions[0];
  const current = requestedVersion !== undefined ? data.versions.find(({ version }) => version.versionNumber === requestedVersion)
    : data.versions.find(({ version }) => version.id === data.item.currentVersionId);
  if (!current) return { body: `That published version of “${data.item.title}” is not available in the latest 100 version records.`, metadata: { workItemId: itemId } };
  const earlier = data.versions.filter(({ version }) => version.versionNumber < current.version.versionNumber);
  const previous = earlier[0];
  // The latest change request on an earlier version defines the requested revision.
  const request = data.reviews.find((review) => review.decision !== "APPROVE" && earlier.some(({ version }) => version.id === review.versionId));
  const requestedBaseline = requestedVersions.length > 1 ? earlier.find(({ version }) => version.versionNumber === requestedVersions[1])
    : request ? earlier.find(({ version }) => version.id === request.versionId) : previous;
  if (requestedVersions.length > 1 && !requestedBaseline) return { body: "The earlier version you asked to compare is not available. Choose two different published versions of this post.", metadata: { workItemId: itemId } };
  const feedback = request ? data.feedback.filter((entry) => entry.reviewDecisionId === request.id).map((entry) => entry.textContent || (entry.kind !== "TEXT" ? `[${entry.kind} feedback requires human review]` : "")).filter(Boolean) : [];
  const lines = [`${data.item.title} — version ${current.version.versionNumber}`, `Status: ${statusLabel[data.item.status] ?? data.item.status}.`, ""];
  let evidence: { unchanged?: boolean; width?: number; height?: number } = {};
  try {
    const currentFile = current.asset ? await inspectFile(current.asset) : null;
    const oldFile = requestedBaseline?.asset ? await inspectFile(requestedBaseline.asset) : null;
    if (currentFile) {
      evidence = { width: currentFile.width, height: currentFile.height, unchanged: oldFile ? currentFile.checksum === oldFile.checksum : undefined };
      lines.push(`Uploaded file: ${current.asset!.originalName} (${currentFile.size.toLocaleString()} bytes).`);
      if (currentFile.width && currentFile.height) lines.push(`Image dimensions: ${currentFile.width} × ${currentFile.height}px.`);
      if (oldFile) lines.push(evidence.unchanged ? `Attention: this file is identical to version ${requestedBaseline!.version.versionNumber}.` : `The file differs from version ${requestedBaseline!.version.versionNumber}. A different file alone does not prove the requested changes were made.`);
      if (currentFile.pixels && oldFile?.pixels) {
        let different = 0;
        for (let i = 0; i < currentFile.pixels.length; i += 3) if (Math.max(...[0, 1, 2].map((channel) => Math.abs(currentFile.pixels![i + channel] - oldFile.pixels![i + channel]))) > 20) different++;
        lines.push(`Visual comparison: ${(different / (128 * 128) * 100).toFixed(1)}% of pixels differ in normalized thumbnails. This measures visual change, not correctness.${currentFile.animated || oldFile.animated ? " Animated images: only the first frame was compared." : ""}`);
      }
      if (currentFile.imageError) lines.push("Image decoding was unavailable; visual checks could not run.");
    } else lines.push("No readable preview file is linked to this version.");
  } catch { lines.push("The stored file could not be inspected. File and visual checks remain unverified."); }
  const checks = checkRevisionRequirements(feedback, evidence);
  const requirementCount = feedback.flatMap((entry) => entry.split(/\n+|;\s*/).filter((part) => part.trim())).length;
  const incompleteChecklist = requirementCount > checks.length || data.feedback.length >= 500;
  if (request) lines.push("", `Client request from ${request.reviewerLabel} (${request.decidedAt.toISOString().slice(0, 10)}):`);
  for (const check of checks) lines.push(`• ${check.result.toUpperCase()}: ${check.requirement}\n  ${check.evidence}`);
  if (!checks.length) lines.push("", request ? "No text checklist was saved with the earlier change request. Ask the client to record specific requirements." : "No earlier client change request was found. There is no saved checklist to validate this revision against.");
  if (current.version.note) lines.push("", `Upload note (author’s description, not verification): ${current.version.note}`);
  if (incompleteChecklist) lines.push("", "Only part of the saved checklist could be included. This report cannot verify the complete request; review all original feedback.");
  const verdict = checks.some((check) => check.result === "missing") ? "MISSING_CHANGES"
    : !incompleteChecklist && checks.length && checks.every((check) => check.result === "verified") ? "CHECKS_PASSED" : "NEEDS_REVIEW";
  lines.push("", verdict === "MISSING_CHANGES" ? "Result: at least one measurable requirement is missing."
    : verdict === "CHECKS_PASSED" ? "Result: the recorded measurable checks passed. A person should still review the content before approval."
    : "Result: human review is needed. I cannot confirm that this version is perfect or that every requested change is complete.");
  lines.push("The post’s approval status has not been changed.");
  const versions = [current, requestedBaseline].filter((entry) => entry !== undefined).map((entry) => ({ versionId: entry.version.id, versionNumber: entry.version.versionNumber, assetId: entry.asset?.id ?? null }));
  return { body: lines.join("\n"), metadata: { engine: "clientloop-local-v1", workItemId: itemId, verdict, checks, versions, reviewDecisionId: request?.id ?? null, analyzedAt: new Date().toISOString() } };
}
async function describeItem(scope: ChatScope, itemId: string, kind: "feedback" | "history"): Promise<Reply> {
  const data = await getAiWorkItem(scope, itemId);
  const lines = [`${data.item.title} — ${kind === "history" ? "version history" : "client feedback"}`];
  for (const { version } of data.versions) {
    const reviews = data.reviews.filter((review) => review.versionId === version.id);
    if (kind === "feedback" && !reviews.length) continue;
    lines.push("", `Version ${version.versionNumber}${version.id === data.item.currentVersionId ? " (current)" : ""}${version.publishedAt ? ` · ${version.publishedAt.toISOString().slice(0, 10)}` : ""}`);
    if (kind === "history" && version.note) lines.push(`Upload note: ${version.note}`);
    for (const review of reviews) {
      lines.push(`${review.reviewerLabel}: ${review.decision.replaceAll("_", " ")} · ${review.decidedAt.toISOString().slice(0, 10)}`);
      for (const entry of data.feedback.filter((feedback) => feedback.reviewDecisionId === review.id)) lines.push(`• ${entry.textContent || `[${entry.kind} feedback requires human review]`}`);
    }
    if (!reviews.length) lines.push("No client decision recorded.");
  }
  if (lines.length === 1) lines.push("No client feedback has been recorded for the available published versions.");
  if (data.versions.length >= 100 || data.reviews.length >= 200 || data.feedback.length >= 500) lines.push("This answer is limited to 100 version records, 200 decisions, and 500 feedback entries.");
  return { body: lines.join("\n"), metadata: { engine: "clientloop-local-v1", workItemId: itemId, queriedAt: new Date().toISOString() } };
}
export async function answerLocally(scope: ChatScope, question: string, itemId?: string): Promise<Reply> {
  const intent = interpretQuestion(question);
  if (intent.kind === "greeting") return { body: `Hello ${scope.userName}! I can help with ${scope.companyName}’s posts, feedback, and revisions. What would you like to check?`, metadata: {} };
  if (intent.kind === "help") return { body: help, metadata: {} };
  if (["review", "feedback", "history"].includes(intent.kind) && itemId) return intent.kind === "review" ? reviewItem(scope, itemId, question) : describeItem(scope, itemId, intent.kind as "feedback" | "history");
  if (["review", "feedback", "history"].includes(intent.kind)) {
    const quoted = question.match(/["“]([^"”]+)["”]/)?.[1];
    if (quoted) {
      const found = await searchAiWorkspace(scope, { kind: "search", query: quoted });
      if (found.items.length === 1) return intent.kind === "review" ? reviewItem(scope, found.items[0].id, question) : describeItem(scope, found.items[0].id, intent.kind as "feedback" | "history");
    }
    return { body: "Choose the post from the ‘Post to discuss’ menu, then ask me to check its latest revision. You can also use its exact title in quotes, for example: Analyze \"Summer launch\" v2.", metadata: {} };
  }
  const data = await searchAiWorkspace(scope, intent);
  const total = data.totals.reduce((sum, row) => sum + Number(row.total), 0);
  const dateNote = intent.since ? ` Updated since ${intent.since.toISOString().slice(0, 10)} (UTC).` : "";
  if (intent.kind === "projects") return { body: `${scope.companyName} — ${data.projects.length === 100 ? "first " : ""}${data.projects.length} projects\n${data.projects.map((project) => `• ${project.name}: ${project.total} published posts`).join("\n") || "No projects yet."}`, metadata: { engine: "clientloop-local-v1" } };
  if (!total) return { body: `No matching published posts found in ${scope.companyName}.${dateNote}${intent.query ? ` Search: “${intent.query}”.` : ""}\n\nTry “Show pending posts”, “Summarize progress”, or “Find posts about "title"”. I can answer questions about saved workspace records; I don’t have a general-knowledge model.`, metadata: {} };
  const lines = [`${scope.companyName}: ${total} matching posts.${dateNote}`];
  const filteredStatus = intent.reviewDecision === "REJECT" ? "rejected" : intent.reviewDecision === "REQUEST_CHANGES" ? "changes requested" : null;
  for (const row of data.totals) lines.push(`• ${filteredStatus ?? statusLabel[row.status] ?? row.status}: ${row.total}`);
  lines.push("", ...data.items.map((item) => `• ${item.title} — ${filteredStatus ?? statusLabel[item.status] ?? item.status}${item.project ? ` · ${item.project}` : ""}`));
  if (total > data.items.length) lines.push(`Showing ${data.items.length} of ${total}. Search a title or project to narrow the results.`);
  return { body: lines.join("\n"), metadata: { engine: "clientloop-local-v1", sources: data.items.map((item) => ({ workItemId: item.id, title: item.title })), queriedAt: new Date().toISOString() } };
}
