import { z } from "zod";
import { assertChatOrigin } from "@/auth/chat";
import { requireRequestSession } from "@/auth/server";
import { correctWriting } from "@/domain/writing-correction";

export const runtime = "nodejs";

const inputSchema = z.object({
  text: z.string().trim().min(1).max(8_000),
  context: z.enum(["message", "feedback", "title", "upload-note", "general"]).default("general"),
});

export async function POST(request: Request) {
  try {
    assertChatOrigin(request);
    await requireRequestSession(request);
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ message: "Enter text up to 8,000 characters." }, { status: 400 });
    const result = correctWriting(parsed.data.text);
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return Response.json({ message: "Please sign in." }, { status: 401 });
    if (error instanceof Error && error.message === "FORBIDDEN") return Response.json({ message: "Request not allowed." }, { status: 403 });
    console.error("Writing correction failed", error);
    return Response.json({ message: "Writing could not be checked. Please try again." }, { status: 500 });
  }
}
