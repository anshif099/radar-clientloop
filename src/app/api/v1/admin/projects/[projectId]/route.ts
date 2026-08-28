import { z } from "zod";
import { requireRequestSuperAdmin } from "@/auth/server";
import { deleteProject, updateProject } from "@/data/companies";

const projectInput = z.object({
  name: z.string().trim().min(2).max(100),
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
  route: { params: Promise<{ projectId: string }> },
) {
  try {
    const session = await requireRequestSuperAdmin(request);
    const { projectId } = await route.params;
    if (!z.uuid().safeParse(projectId).success) {
      return Response.json({ message: "Select a valid project." }, { status: 400 });
    }

    const parsed = projectInput.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ message: "Enter a valid project name." }, { status: 400 });
    }

    const project = await updateProject({ projectId, name: parsed.data.name, actorId: session.user.id });
    return Response.json({ project });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      return Response.json({ message: "Project not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "PROJECT_EXISTS") {
      return Response.json({ message: "That project name already exists for this company." }, { status: 409 });
    }
    return Response.json({ message: "Project could not be updated." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  route: { params: Promise<{ projectId: string }> },
) {
  try {
    const session = await requireRequestSuperAdmin(request);
    const { projectId } = await route.params;
    if (!z.uuid().safeParse(projectId).success) {
      return Response.json({ message: "Select a valid project." }, { status: 400 });
    }

    await deleteProject({ projectId, actorId: session.user.id });
    return new Response(null, { status: 204 });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      return Response.json({ message: "Project not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "PROJECT_NOT_EMPTY") {
      return Response.json(
        { message: "This project contains posters and cannot be deleted. Move or remove its posters first." },
        { status: 409 },
      );
    }
    return Response.json({ message: "Project could not be deleted." }, { status: 500 });
  }
}
