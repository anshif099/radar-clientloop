import { z } from "zod";
import { getRequestSession } from "@/auth/server";
import { getCompanyContextForIdentity, recordCompanyDecision } from "@/data/companies";

const reviewInput = z
  .object({
    decision: z.enum(["APPROVE", "REQUEST_CHANGES", "REJECT"]),
    feedback: z.string().trim().max(5000).optional(),
    idempotencyKey: z.string().min(10).max(160),
  })
  .refine((input) => input.decision === "APPROVE" || Boolean(input.feedback), {
    message: "Feedback is required for changes or rejection.",
  });

export async function POST(request: Request, route: { params: Promise<{ posterId: string }> }) {
  const session = await getRequestSession(request).catch(() => null);
  if (!session || session.user.role === "admin") {
    return Response.json({ message: "Please sign in with a company account." }, { status: 401 });
  }
  const company = await getCompanyContextForIdentity(session.user.id);
  if (!company) return Response.json({ message: "Company access is not configured." }, { status: 403 });

  const parsed = reviewInput.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ message: parsed.error.issues[0]?.message ?? "Invalid review." }, { status: 400 });
  }

  try {
    const { posterId } = await route.params;
    if (!z.uuid().safeParse(posterId).success) {
      return Response.json({ message: "Poster not found." }, { status: 404 });
    }
    const result = await recordCompanyDecision({
      context: company,
      itemId: posterId,
      ...parsed.data,
      authUserId: session.user.id,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return Response.json({ message: "Poster not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "NOT_REVIEWABLE") {
      return Response.json({ message: "This poster has already been reviewed." }, { status: 409 });
    }
    const databaseError = error as { code?: string };
    if (databaseError.code === "23505") {
      return Response.json({ message: "This review was already submitted." }, { status: 409 });
    }
    throw error;
  }
}
