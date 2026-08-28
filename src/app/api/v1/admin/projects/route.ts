import { z } from "zod";
import { requireRequestSuperAdmin } from "@/auth/server";
import { createProject } from "@/data/companies";

const projectInput = z.object({
  companyId: z.uuid(),
  name: z.string().trim().min(2).max(100),
});

export async function POST(request: Request) {
  try {
    const session = await requireRequestSuperAdmin(request);
    const parsed = projectInput.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ message: "Select a company and enter a valid project name." }, { status: 400 });
    }

    const project = await createProject({ ...parsed.data, actorId: session.user.id });
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return Response.json({ message: "Please sign in." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return Response.json({ message: "Super Admin access is required." }, { status: 403 });
    }
    if (error instanceof Error && error.message === "COMPANY_NOT_FOUND") {
      return Response.json({ message: "Company not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "PROJECT_EXISTS") {
      return Response.json({ message: "That project already exists for this company." }, { status: 409 });
    }
    return Response.json({ message: "Project could not be created." }, { status: 500 });
  }
}
