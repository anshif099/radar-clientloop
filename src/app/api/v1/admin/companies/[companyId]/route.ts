import { z } from "zod";
import { auth, requireRequestSuperAdmin } from "@/auth/server";
import { deleteCompany, updateCompany } from "@/data/companies";

const companyInput = z.object({
  name: z.string().trim().min(2).max(180),
  email: z.email().max(320),
  password: z.union([z.literal(""), z.string().min(12).max(128)]).optional(),
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

export async function PATCH(
  request: Request,
  route: { params: Promise<{ companyId: string }> },
) {
  let detailsUpdated = false;
  try {
    const session = await requireRequestSuperAdmin(request);
    const { companyId } = await route.params;
    if (!z.uuid().safeParse(companyId).success) {
      return Response.json({ message: "Select a valid company." }, { status: 400 });
    }

    const parsed = companyInput.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { message: "Enter a valid company name, login email, and a new password of at least 12 characters if changing it." },
        { status: 400 },
      );
    }

    const { password, ...companyDetails } = parsed.data;
    const updated = await updateCompany({ companyId, ...companyDetails, actorId: session.user.id });
    detailsUpdated = true;

    if (password) {
      await auth.api.setUserPassword({
        body: { userId: updated.authUserId, newPassword: password },
        headers: request.headers,
      });
      await auth.api.revokeUserSessions({
        body: { userId: updated.authUserId },
        headers: request.headers,
      });
    }

    const { authUserId: _authUserId, ...company } = updated;
    return Response.json({ company, passwordUpdated: Boolean(password) });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    if (error instanceof Error && error.message === "COMPANY_NOT_FOUND") {
      return Response.json({ message: "Company not found." }, { status: 404 });
    }
    if (detailsUpdated) {
      return Response.json(
        { message: "Company details were saved, but the new password could not be applied." },
        { status: 500 },
      );
    }
    return Response.json(
      { message: "Company update failed. The login email may already be in use." },
      { status: 409 },
    );
  }
}

export async function DELETE(
  request: Request,
  route: { params: Promise<{ companyId: string }> },
) {
  try {
    const session = await requireRequestSuperAdmin(request);
    const { companyId } = await route.params;
    if (!z.uuid().safeParse(companyId).success) {
      return Response.json({ message: "Select a valid company." }, { status: 400 });
    }

    await deleteCompany({ companyId, actorId: session.user.id });
    return new Response(null, { status: 204 });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    if (error instanceof Error && error.message === "COMPANY_NOT_FOUND") {
      return Response.json({ message: "Company not found." }, { status: 404 });
    }
    return Response.json({ message: "Company could not be deleted." }, { status: 500 });
  }
}
