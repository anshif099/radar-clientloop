import { randomUUID } from "node:crypto";
import { getRequestSession } from "@/auth/server";
import { createPosterRequest, getCompanyContextForIdentity } from "@/data/companies";
import { detectUploadType } from "@/domain/asset-upload";
import { deleteObject, putObject } from "@/storage/filesystem";

export async function POST(request: Request) {
  let storageKey: string | undefined;
  try {
    const session = await getRequestSession(request).catch(() => null);
    if (!session) return Response.json({ message: "Please sign in with a company account." }, { status: 401 });
    const context = await getCompanyContextForIdentity(session.user.id);
    if (!context) return Response.json({ message: "Company access is required." }, { status: 403 });
    const form = await request.formData();
    const title = String(form.get("title") ?? "").trim();
    const prompt = String(form.get("prompt") ?? "").trim();
    const projectId = String(form.get("projectId") ?? "").trim();
    if (title.length < 2 || title.length > 220 || prompt.length < 3 || prompt.length > 12000 || !projectId) return Response.json({ message: "Choose a project and enter a title and design prompt." }, { status: 400 });
    const file = form.get("reference");
    let asset: { id: string; storageKey: string; originalName: string; mimeType: string; sizeBytes: number } | undefined;
    if (file instanceof File && file.size) {
      if (file.size > 20 * 1024 * 1024) return Response.json({ message: "Reference images must be 20 MB or smaller." }, { status: 400 });
      const bytes = new Uint8Array(await file.arrayBuffer());
      const detected = detectUploadType(bytes, file.name);
      if (!detected || detected.contentType !== "image") return Response.json({ message: "Attach a supported image reference." }, { status: 400 });
      const id = randomUUID();
      storageKey = `agencies/${context.agencyId}/requests/${id}.${detected.extension}`;
      await putObject({ key: storageKey, bytes, contentType: detected.mimeType });
      asset = { id, storageKey, originalName: file.name.slice(0, 255), mimeType: detected.mimeType, sizeBytes: bytes.byteLength };
    }
    const poster = await createPosterRequest({ context, projectId, title, prompt, asset });
    return Response.json({ poster }, { status: 201 });
  } catch (error) {
    if (storageKey) await deleteObject(storageKey).catch(() => undefined);
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") return Response.json({ message: "Project not found." }, { status: 404 });
    console.error("Poster request failed", error);
    return Response.json({ message: "Poster request could not be sent." }, { status: 500 });
  }
}
