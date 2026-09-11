import { z } from "zod";
import { requireRequestSuperAdmin } from "@/auth/server";
import { deletePosterVersion } from "@/data/companies";
import { deleteObject } from "@/storage/filesystem";

export async function DELETE(
  request: Request,
  route: { params: Promise<{ posterId: string; versionId: string }> },
) {
  try {
    const session = await requireRequestSuperAdmin(request);
    const { posterId, versionId } = await route.params;
    if (!z.uuid().safeParse(posterId).success || !z.uuid().safeParse(versionId).success) {
      return Response.json({ message: "Select a valid poster version." }, { status: 400 });
    }

    const version = await deletePosterVersion({ posterId, versionId, actorId: session.user.id });
    const cleanup = await Promise.allSettled(version.storageKeys.map((storageKey) => deleteObject(storageKey)));
    const cleanupPending = cleanup.filter(({ status }) => status === "rejected").length;
    if (cleanupPending) {
      console.error(`Poster version ${version.versionId} was deleted, but ${cleanupPending} stored file(s) could not be removed.`);
    }
    return Response.json({
      version: {
        id: version.versionId,
        versionNumber: version.versionNumber,
        currentVersionId: version.currentVersionId,
      },
      cleanupPending,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return Response.json({ message: "Please sign in." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return Response.json({ message: "Super Admin access is required." }, { status: 403 });
    }
    if (error instanceof Error && (error.message === "POSTER_NOT_FOUND" || error.message === "VERSION_NOT_FOUND")) {
      return Response.json({ message: "Poster version not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "LAST_VERSION") {
      return Response.json({ message: "Delete the entire poster to remove its only version." }, { status: 409 });
    }
    console.error("Poster version deletion failed", error);
    return Response.json({ message: "Poster version could not be deleted." }, { status: 500 });
  }
}
