import { z } from "zod";
import { requireRequestSuperAdmin } from "@/auth/server";
import { createSubAdmin, listSubAdmins } from "@/data/companies";
import { subAdminPositions } from "@/domain/sub-admins";

const inputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.email().max(255),
  password: z.string().min(12).max(128),
  position: z.enum(subAdminPositions),
});

function authError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return Response.json({ message: "Please sign in." }, { status: 401 });
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return Response.json({ message: "Super Admin access is required." }, { status: 403 });
  }
  return null;
}

export async function GET(request: Request) {
  try {
    await requireRequestSuperAdmin(request);
    return Response.json({ subAdmins: await listSubAdmins() });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    return Response.json({ message: "Sub Admins could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRequestSuperAdmin(request);
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ message: "Enter a valid name, position, email, and password of at least 12 characters." }, { status: 400 });
    }
    const subAdmin = await createSubAdmin({ ...parsed.data, actorId: session.user.id });
    return Response.json({ subAdmin }, { status: 201 });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    return Response.json({ message: "Sub Admin creation failed. The email may already be in use." }, { status: 409 });
  }
}
