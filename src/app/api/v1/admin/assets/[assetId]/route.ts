import { z } from "zod";
import { requireRequestSuperAdmin } from "@/auth/server";
import { getAdminAsset } from "@/data/companies";
import { readObject } from "@/storage/filesystem";

export async function GET(request: Request, context: { params: Promise<{ assetId: string }> }) {
  try {
    await requireRequestSuperAdmin(request);
    const { assetId } = await context.params;
    if (!z.uuid().safeParse(assetId).success) {
      return Response.json({ message: "Asset not found." }, { status: 404 });
    }

    const asset = await getAdminAsset(assetId);
    if (!asset) return Response.json({ message: "Asset not found." }, { status: 404 });
    const body = await readObject(asset.storageKey).catch(() => null);
    if (!body) return Response.json({ message: "Asset is unavailable." }, { status: 404 });

    const download = new URL(request.url).searchParams.get("download") === "1";
    const disposition = `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(asset.originalName)}`;
    return new Response(body, {
      headers: {
        "Cache-Control": "private, max-age=300",
        "Content-Disposition": disposition,
        "Content-Type": asset.mimeType ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return Response.json({ message: "Please sign in." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return Response.json({ message: "Super Admin access is required." }, { status: 403 });
    }
    throw error;
  }
}
