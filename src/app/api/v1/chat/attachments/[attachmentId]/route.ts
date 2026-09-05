import { chatError, requireChatScope } from "@/auth/chat";
import { getChatAttachment } from "@/data/chat";
import { assetResponse } from "@/storage/asset-response";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ attachmentId: string }> }) {
  try {
    const scope = await requireChatScope(request);
    const { attachmentId } = await context.params;
    const asset = await getChatAttachment(scope, attachmentId);
    if (!asset) throw new Error("NOT_FOUND");
    const response = await assetResponse(request, asset);
    response.headers.set("Cache-Control", "private, no-store");
    // Untrusted text and archives are downloaded, never executed in the app origin.
    if (!/^(image\/|video\/|audio\/|application\/pdf$)/.test(asset.mimeType)) response.headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(asset.originalName)}`);
    return response;
  } catch (error) { return chatError(error); }
}
export const HEAD = GET;
