import { getRequestSession } from "@/auth/server";
import { getCompanyAsset, getCompanyContextForIdentity } from "@/data/companies";
import { assetResponse } from "@/storage/asset-response";
import { z } from "zod";

export async function GET(request: Request, context: { params: Promise<{ assetId: string }> }) {
  const session = await getRequestSession(request).catch(() => null);
  if (!session || session.user.role === "admin") {
    return Response.json({ message: "Not authorized." }, { status: 401 });
  }

  const company = await getCompanyContextForIdentity(session.user.id);
  if (!company) return Response.json({ message: "Company access is not configured." }, { status: 403 });

  const { assetId } = await context.params;
  if (!z.uuid().safeParse(assetId).success) {
    return Response.json({ message: "Asset not found." }, { status: 404 });
  }
  const asset = await getCompanyAsset(company, assetId);
  if (!asset) return Response.json({ message: "Asset not found." }, { status: 404 });

  return assetResponse(request, asset);
}

export const HEAD = GET;
