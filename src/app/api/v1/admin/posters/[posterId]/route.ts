import { z } from "zod";
import { requireRequestSuperAdmin } from "@/auth/server";
import { deletePoster } from "@/data/companies";
import { deleteObject } from "@/storage/filesystem";

export async function DELETE(
  request: Request,
  route: { params: Promise<{ posterId: string }> },
) {
  try {
    const session = await requireRequestSuperAdmin(request);
    const { posterId } = await route.params;
    if (!z.uuid().safeParse(posterId).success) {
      return Response.json({ message: "Select a valid poster." }, { status: 400 });
    }

    const poster = await deletePoster({ posterId, actorId: session.user.id });
    const cleanup = await Promise.allSettled(poster.storageKeys.map((storageKey) => deleteObject(storageKey)));
    const cleanupPending = cleanup.filter(({ status }) => status === "rejected").length;
    if (cleanupPending) {
      console.error(`Poster ${poster.id} was deleted, but ${cleanupPending} stored file(s) could not be removed.`);
    }
    return Response.json({ poster: { id: poster.id }, cleanupPending });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return Response.json({ message: "Please sign in." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return Response.json({ message: "Super Admin access is required." }, { status: 403 });
    }
    if (error instanceof Error && error.message === "POSTER_NOT_FOUND") {
      return Response.json({ message: "Poster not found." }, { status: 404 });
    }
    console.error("Poster deletion failed", error);
    return Response.json({ message: "Poster could not be deleted." }, { status: 500 });
  }
}
