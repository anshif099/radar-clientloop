import { z } from "zod";
import { requireRequestSuperAdmin } from "@/auth/server";
import { getAdminAsset } from "@/data/companies";
import { assetResponse } from "@/storage/asset-response";

export async function GET(request: Request, context: { params: Promise<{ assetId: string }> }) {
  try {
    await requireRequestSuperAdmin(request);
    const { assetId } = await context.params;
    if (!z.uuid().safeParse(assetId).success) {
      return Response.json({ message: "Asset not found." }, { status: 404 });
    }

    const asset = await getAdminAsset(assetId);
    if (!asset) return Response.json({ message: "Asset not found." }, { status: 404 });
    return await assetResponse(request, asset);
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

export const HEAD = GET;
