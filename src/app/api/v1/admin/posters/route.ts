import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireRequestSuperAdmin } from "@/auth/server";
import {
  createPoster,
  createPosterVersion,
  getCompanyForAdmin,
  getProjectForAdmin,
} from "@/data/companies";
import { deleteObject, putObject } from "@/storage/filesystem";
import { contentTypeOptions, isContentType, normalizeWebsiteUrl, websiteMimeType } from "@/domain/asset-types";
import { detectUploadType, validateUploadSize } from "@/domain/asset-upload";

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
    const posterId = value(form, "posterId");
    const title = value(form, "title");
    const note = value(form, "note");
    const file = form.get("file");
    const contentType = value(form, "contentType") || "image";

    if (
      !z.uuid().safeParse(companyId).success
      || !z.uuid().safeParse(projectId).success
      || (!posterId && !title)
      || title.length > 220
      || note.length > 3000
      || (posterId && !z.uuid().safeParse(posterId).success)
    ) {
      return Response.json({ message: "Company, project, and poster title are required." }, { status: 400 });
    }
    if (!isContentType(contentType)) {
      return Response.json({ message: "Select a supported content type." }, { status: 400 });
    }

    const company = await getCompanyForAdmin(companyId);
    if (!company) return Response.json({ message: "Company not found." }, { status: 404 });
    const project = await getProjectForAdmin(companyId, projectId);
    if (!project) return Response.json({ message: "Project not found for the selected company." }, { status: 404 });

    let bytes: Uint8Array;
    let mimeType: string;
    let extension: string;
    let originalName: string;
    if (contentType === "website") {
      const websiteUrl = normalizeWebsiteUrl(value(form, "websiteUrl"));
      if (!websiteUrl) return Response.json({ message: "Enter a valid http:// or https:// website link (up to 2,048 characters, without login credentials)." }, { status: 400 });
      // Store links as URI-list assets so they retain the same access and version history as files.
      bytes = new TextEncoder().encode(`${websiteUrl}\r\n`);
      mimeType = websiteMimeType;
      extension = "url";
      originalName = new URL(websiteUrl).hostname.slice(0, 255);
    } else {
      if (!(file instanceof File) || !validateUploadSize(file.size, contentType)) {
        return Response.json({ message: `Select a ${contentTypeOptions[contentType].label} file. ${contentTypeOptions[contentType].help}.` }, { status: 400 });
      }
      bytes = new Uint8Array(await file.arrayBuffer());
      const detected = detectUploadType(bytes, file.name);
      if (!detected || detected.contentType !== contentType) {
        return Response.json({ message: `The file content does not match the selected ${contentTypeOptions[contentType].label} type or supported file extension.` }, { status: 400 });
      }
      mimeType = detected.mimeType;
      extension = detected.extension;
      originalName = file.name.slice(0, 255);
    }
    storageKey = `agencies/${company.id}/projects/${project.id}/posters/${posterId || randomUUID()}/${randomUUID()}.${extension}`;
    await putObject({
      key: storageKey,
      bytes,
      contentType: mimeType,
    });
    const fileDetails = {
      companyId: company.id,
      workspaceId: company.workspaceId,
      projectId: project.id,
      note,
      storageKey,
      originalName,
      mimeType,
      sizeBytes: bytes.byteLength,
      actorId: session.user.id,
    };
    const poster = posterId
      ? await createPosterVersion({ ...fileDetails, posterId })
      : await createPoster({ ...fileDetails, title });
    return Response.json({ poster: { ...poster, contentType, originalName } }, { status: 201 });
  } catch (error) {
    if (storageKey) await deleteObject(storageKey).catch(() => undefined);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return Response.json({ message: "Please sign in." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return Response.json({ message: "Super Admin access is required." }, { status: 403 });
    }
    if (error instanceof Error && error.message === "POSTER_NOT_FOUND") {
      return Response.json({ message: "Poster not found in the selected project." }, { status: 404 });
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
