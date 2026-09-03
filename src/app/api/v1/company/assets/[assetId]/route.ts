import { getRequestSession } from "@/auth/server";
import { getCompanyAsset, getCompanyContextForIdentity } from "@/data/companies";
import { readObject } from "@/storage/filesystem";
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
}
