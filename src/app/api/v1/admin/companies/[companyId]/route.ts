import { z } from "zod";
import { requireRequestSuperAdmin } from "@/auth/server";
import { deleteCompany, updateCompany } from "@/data/companies";

const companyInput = z.object({
  name: z.string().trim().min(2).max(180),
  email: z.email().max(320),
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
  try {
    const session = await requireRequestSuperAdmin(request);
    const { companyId } = await route.params;
    if (!z.uuid().safeParse(companyId).success) {
      return Response.json({ message: "Select a valid company." }, { status: 400 });
    }

    const parsed = companyInput.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ message: "Enter a valid company name and login email." }, { status: 400 });
    }

    const company = await updateCompany({ companyId, ...parsed.data, actorId: session.user.id });
    return Response.json({ company });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    if (error instanceof Error && error.message === "COMPANY_NOT_FOUND") {
      return Response.json({ message: "Company not found." }, { status: 404 });
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
