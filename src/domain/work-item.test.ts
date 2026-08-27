import { describe, expect, it } from "vitest";
import {
  feedbackInputSchema,
  InvalidWorkItemTransitionError,
  requiresFeedback,
  transitionWorkItem,
} from "./work-item";

describe("work item lifecycle", () => {
  it("publishes a draft for client review", () => {
    expect(transitionWorkItem("DRAFT", "PUBLISH_VERSION")).toBe("AWAITING_CLIENT_REVIEW");
  });

  it("keeps both changes and rejection in the revision loop", () => {
    expect(transitionWorkItem("AWAITING_CLIENT_REVIEW", "REQUEST_CHANGES")).toBe(
      "REVISION_REQUIRED",
    );
    expect(transitionWorkItem("AWAITING_CLIENT_REVIEW", "REJECT")).toBe("REVISION_REQUIRED");
  });

  it("requires a privileged reopen before an approved item can change", () => {
    expect(() => transitionWorkItem("APPROVED", "REQUEST_CHANGES")).toThrow(
      InvalidWorkItemTransitionError,
    );
    expect(transitionWorkItem("APPROVED", "REOPEN")).toBe("REVISION_REQUIRED");
  });

  it("does not allow archived work to transition", () => {
    expect(() => transitionWorkItem("ARCHIVED", "PUBLISH_VERSION")).toThrow(
      InvalidWorkItemTransitionError,
    );
  });
});

describe("review feedback", () => {
  it("requires at least one feedback input", () => {
    expect(feedbackInputSchema.safeParse({}).success).toBe(false);
    expect(feedbackInputSchema.safeParse({ text: "Please increase the logo size" }).success).toBe(
      true,
    );
  });

  it("requires feedback for change and reject decisions only", () => {
    expect(requiresFeedback("APPROVE")).toBe(false);
    expect(requiresFeedback("REQUEST_CHANGES")).toBe(true);
    expect(requiresFeedback("REJECT")).toBe(true);
  });
});
