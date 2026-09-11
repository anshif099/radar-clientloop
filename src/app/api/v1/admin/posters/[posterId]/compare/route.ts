import { z } from "zod";
import { analyzeRevision, RevisionComparisonInputError } from "@/revision/revision-check";
import { assertChatOrigin } from "@/auth/chat";
import { requireRequestAdmin } from "@/auth/server";
import { getRevisionComparisonSource } from "@/data/revision-comparison";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ posterId: string }> }) {
  try {
    assertChatOrigin(request);
    await requireRequestAdmin(request);
    const { posterId } = await context.params;
    if (!z.uuid().safeParse(posterId).success) return Response.json({ message: "Poster not found." }, { status: 404 });
    const source = await getRevisionComparisonSource(posterId);
    if (!source) return Response.json({ message: "Upload a new version after written client changes before running this check." }, { status: 409 });
    const result = await analyzeRevision(source);
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof RevisionComparisonInputError) return Response.json({ message: error.message }, { status: 422 });
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return Response.json({ message: "Please sign in." }, { status: 401 });
    if (error instanceof Error && error.message === "FORBIDDEN") return Response.json({ message: "Super Admin access is required." }, { status: 403 });
    console.error("Revision comparison failed", error);
    return Response.json({ message: "The revision could not be checked. Please try again." }, { status: 500 });
  }
}
