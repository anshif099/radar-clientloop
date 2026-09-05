// ClientLoop's local, deterministic language interpreter. No model or remote API.
export interface LocalIntent {
  kind: "review" | "feedback" | "history" | "summary" | "search" | "projects" | "help" | "greeting";
  status?: "APPROVED" | "AWAITING_CLIENT_REVIEW" | "REVISION_REQUIRED";
  reviewDecision?: "REQUEST_CHANGES" | "REJECT";
  query: string;
  since?: Date;
}
export function interpretQuestion(question: string, now = new Date()): LocalIntent {
  const text = question.toLowerCase().normalize("NFKC").trim();
  const status = /\b(unapproved|not approved|pending|awaiting)\b/.test(text) ? "AWAITING_CLIENT_REVIEW"
    : /\b(changes?|revision|rejected|rework)\b/.test(text) ? "REVISION_REQUIRED"
    : /\b(approved|accepted)\b/.test(text) ? "APPROVED" : undefined;
  const reviewDecision = /\b(rejected)\b/.test(text) ? "REJECT" : /\bchanges\b/.test(text) ? "REQUEST_CHANGES" : undefined;
  let since: Date | undefined;
  if (/\b(today|this week|this month|last \d+ days?)\b/.test(text)) {
    since = new Date(now);
    const days = text.match(/last (\d+) days?/);
    if (days) since.setUTCDate(since.getUTCDate() - Math.min(Number(days[1]), 3650));
    else if (text.includes("this week")) since.setUTCDate(since.getUTCDate() - ((since.getUTCDay() + 6) % 7));
    else if (text.includes("this month")) since.setUTCDate(1);
    since.setUTCHours(0, 0, 0, 0);
  }
  const query = question.match(/["“]([^"”]+)["”]/)?.[1]?.trim()
    ?? question.replace(/\b(?:please|can|could|you|me|my|our|the|a|an|all|show|list|find|search|for|posts?|posters?|items?|content|work|about|tell|in|project|approved|pending|awaiting|changes|requested|revisions?|rejected|today|this week|this month|last \d+ days?|which|what|that|are|is|needs?|have|has|with|to|of)\b/gi, " ").replace(/[?!.,]/g, " ").replace(/\s+/g, " ").trim();
  if (/^(hi|hello|hey|good morning|good evening)[!. ]*$/.test(text)) return { kind: "greeting", query: "" };
  if (/\b(history|previous versions|all versions)\b/.test(text)) return { kind: "history", query: "" };
  if (/\b(analy[sz]e|analize|compare|check|perfect|missing|fixed|satisfied|review|v\d+|version \d+)\b/.test(text) && !/awaiting review|pending review/.test(text)) return { kind: "review", query, status, since };
  if (/\b(feedback|suggestions?|client.*request|client.*changes|requested changes)\b/.test(text)) return { kind: "feedback", query: "" };
  if (/\b(help|how (do|can|to)|what can|who are)\b/.test(text)) return { kind: "help", query: "" };
  if (/\b(projects|campaigns)\b/.test(text) && !/\b(posts?|posters?|items?)\b/.test(text)) return { kind: "projects", query: "", since };
  if (/\b(how many|count|total|summary|summari[sz]e|overview|progress|status)\b/.test(text)) return { kind: "summary", query: "", status, reviewDecision, since };
  return { kind: "search", query, status, reviewDecision, since };
}

export interface RevisionCheck { requirement: string; result: "verified" | "missing" | "unverified"; evidence: string }
export function checkRevisionRequirements(feedback: string[], evidence: { unchanged?: boolean; width?: number; height?: number; note?: string }): RevisionCheck[] {
  // Keep each original request intact; an upload note is a claim, never proof.
  return feedback.flatMap((entry) => entry.split(/\n+|;\s*/).map((part) => part.trim()).filter(Boolean)).slice(0, 100).map((requirement) => {
    const size = requirement.match(/\b(\d{2,5})\s*[x×]\s*(\d{2,5})\b/i);
    if (size && evidence.width && evidence.height) {
      const matches = Number(size[1]) === evidence.width && Number(size[2]) === evidence.height;
      // Only an otherwise purely dimensional request can be fully checked.
      const remainder = requirement.replace(size[0], " ").replace(/\b(please|make|it|the|image|poster|size|resize|to|at|px|pixels|resolution|dimensions|should|be|must|change|use|of)\b/gi, "").replace(/[\s.,!?:-]/g, "");
      return { requirement, result: !matches ? "missing" : remainder ? "unverified" : "verified", evidence: `File dimensions: ${evidence.width} × ${evidence.height}px. ${!matches ? "Requested dimensions do not match." : remainder ? "Dimensions match; the rest of this request still needs human review." : "Requested dimensions match."}` };
    }
    return { requirement, result: "unverified", evidence: evidence.unchanged
      ? "The uploaded file is byte-for-byte identical to the earlier version. This request has not been verified."
      : "Human review needed: local file comparison cannot verify wording, layout, logos, colors, motion, or spoken content." };
  });
}
