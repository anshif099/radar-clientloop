import { z } from "zod";
import { requireRequestSuperAdmin } from "@/auth/server";
import { createCompany, listCompaniesForAdmin } from "@/data/companies";

const companyInput = z.object({
  name: z.string().trim().min(2).max(180),
  email: z.email().max(320),
  password: z.string().min(12).max(128),
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
    return Response.json({ companies: await listCompaniesForAdmin() });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    await requireRequestSuperAdmin(request);
    const parsed = companyInput.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { message: "Enter a valid company name, email, and password of at least 12 characters." },
        { status: 400 },
      );
    }
    const company = await createCompany(parsed.data);
    return Response.json({ company }, { status: 201 });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    return Response.json(
      { message: "Company creation failed. The login email may already be in use." },
      { status: 400 },
    );
  }
}
