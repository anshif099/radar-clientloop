import { z } from "zod";

export const workItemStatusSchema = z.enum([
  "DRAFT",
  "AWAITING_CLIENT_REVIEW",
  "REVISION_REQUIRED",
  "APPROVED",
  "ARCHIVED",
]);

export const reviewDecisionSchema = z.enum(["APPROVE", "REQUEST_CHANGES", "REJECT"]);

export type WorkItemStatus = z.infer<typeof workItemStatusSchema>;
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;

export class InvalidWorkItemTransitionError extends Error {
  constructor(from: WorkItemStatus, command: WorkItemCommand) {
    super(`Cannot apply ${command} while work item is ${from}.`);
    this.name = "InvalidWorkItemTransitionError";
  }
}

export type WorkItemCommand =
  | "PUBLISH_VERSION"
  | "APPROVE"
  | "REQUEST_CHANGES"
  | "REJECT"
  | "REOPEN"
  | "ARCHIVE";

const transitions: Record<WorkItemStatus, Partial<Record<WorkItemCommand, WorkItemStatus>>> = {
  DRAFT: {
    PUBLISH_VERSION: "AWAITING_CLIENT_REVIEW",
    ARCHIVE: "ARCHIVED",
  },
  AWAITING_CLIENT_REVIEW: {
    APPROVE: "APPROVED",
    REQUEST_CHANGES: "REVISION_REQUIRED",
    REJECT: "REVISION_REQUIRED",
    ARCHIVE: "ARCHIVED",
  },
  REVISION_REQUIRED: {
    PUBLISH_VERSION: "AWAITING_CLIENT_REVIEW",
    ARCHIVE: "ARCHIVED",
  },
  APPROVED: {
    REOPEN: "REVISION_REQUIRED",
    ARCHIVE: "ARCHIVED",
  },
  ARCHIVED: {},
};

export function transitionWorkItem(from: WorkItemStatus, command: WorkItemCommand): WorkItemStatus {
  const next = transitions[from][command];
  if (!next) throw new InvalidWorkItemTransitionError(from, command);
  return next;
}

export const feedbackInputSchema = z
  .object({
    text: z.string().trim().max(10_000).optional(),
    voiceAssetId: z.uuid().optional(),
    referenceAssetId: z.uuid().optional(),
    referenceUrl: z.url().max(2_048).optional(),
  })
  .refine(
    (feedback) =>
      Boolean(
        feedback.text ||
          feedback.voiceAssetId ||
          feedback.referenceAssetId ||
          feedback.referenceUrl,
      ),
    { message: "Changes and rejection require text, voice, a reference file, or a reference URL." },
  );

export function requiresFeedback(decision: ReviewDecision) {
  return decision === "REQUEST_CHANGES" || decision === "REJECT";
}
