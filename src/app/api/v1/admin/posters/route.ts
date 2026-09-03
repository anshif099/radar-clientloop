import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireRequestSuperAdmin } from "@/auth/server";
import { createPoster, getCompanyForAdmin, getProjectForAdmin } from "@/data/companies";
import { deleteObject, putObject } from "@/storage/filesystem";

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const maximumFileSize = 20 * 1024 * 1024;

function detectImageType(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }
  if (bytes.length >= 8 && bytes.slice(0, 8).every((byte, index) => byte === [137, 80, 78, 71, 13, 10, 26, 10][index])) {
    return { mimeType: "image/png", extension: "png" };
  }
  const prefix = new TextDecoder("ascii").decode(bytes.slice(0, 12));
  if (prefix.startsWith("GIF87a") || prefix.startsWith("GIF89a")) {
    return { mimeType: "image/gif", extension: "gif" };
  }
  if (prefix.startsWith("RIFF") && prefix.slice(8, 12) === "WEBP") {
    return { mimeType: "image/webp", extension: "webp" };
  }
  return null;
}

function value(form: FormData, key: string) {
  const entry = form.get(key);
  return typeof entry === "string" ? entry.trim() : "";
}

export async function POST(request: Request) {
  let storageKey: string | null = null;

  try {
    const session = await requireRequestSuperAdmin(request);
    const form = await request.formData();
    const companyId = value(form, "companyId");
    const projectId = value(form, "projectId");
    const title = value(form, "title");
    const note = value(form, "note");
    const file = form.get("file");

    if (
      !z.uuid().safeParse(companyId).success
      || !z.uuid().safeParse(projectId).success
      || !title
      || title.length > 220
    ) {
      return Response.json({ message: "Company, project, and poster title are required." }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ message: "Select a poster image." }, { status: 400 });
    }
    if (!allowedMimeTypes.has(file.type) || file.size > maximumFileSize) {
      return Response.json(
        { message: "Use a JPG, PNG, WebP, or GIF image up to 20 MB." },
        { status: 400 },
      );
    }

    const company = await getCompanyForAdmin(companyId);
    if (!company) return Response.json({ message: "Company not found." }, { status: 404 });
    const project = await getProjectForAdmin(companyId, projectId);
    if (!project) return Response.json({ message: "Project not found for the selected company." }, { status: 404 });

    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = detectImageType(bytes);
    if (!detected || detected.mimeType !== file.type) {
      return Response.json({ message: "The uploaded file content is not a valid supported image." }, { status: 400 });
    }
    storageKey = `agencies/${company.id}/projects/${project.id}/posters/${randomUUID()}.${detected.extension}`;
    await putObject({
      key: storageKey,
      bytes,
      contentType: detected.mimeType,
    });
    const poster = await createPoster({
      companyId: company.id,
      workspaceId: company.workspaceId,
      projectId: project.id,
      title,
      note,
      storageKey,
      originalName: file.name.slice(0, 255),
      mimeType: detected.mimeType,
      sizeBytes: file.size,
      actorId: session.user.id,
    });
    return Response.json({ poster }, { status: 201 });
  } catch (error) {
    if (storageKey) await deleteObject(storageKey).catch(() => undefined);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return Response.json({ message: "Please sign in." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return Response.json({ message: "Super Admin access is required." }, { status: 403 });
    }
    console.error("Poster upload failed", error);
    if (error instanceof Error && error.message.startsWith("Poster storage is not configured")) {
      return Response.json(
        { message: "Poster storage is not configured. Set UPLOAD_ROOT, then try again." },
        { status: 503 },
      );
    }
    return Response.json({ message: "Poster upload failed. Please try again." }, { status: 500 });
  }
}
