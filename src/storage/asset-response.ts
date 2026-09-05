import "server-only";

import { contentTypeFromMime, normalizeWebsiteUrl, websiteMimeType } from "../domain/asset-types";
import { parseByteRange } from "../domain/byte-range";
import { objectSize, readObject } from "./filesystem";

export async function assetResponse(request: Request, asset: { storageKey: string; originalName: string; mimeType: string | null }) {
  const size = await objectSize(asset.storageKey).catch(() => null);
  if (size === null) return Response.json({ message: "Asset is unavailable." }, { status: 404 });

  if (asset.mimeType === websiteMimeType) {
    if (size > 8192) return Response.json({ message: "Website link is unavailable." }, { status: 404 });
    const body = await readObject(asset.storageKey).catch(() => null);
    const url = body ? normalizeWebsiteUrl(await new Response(body).text()) : null;
    if (!url) return Response.json({ message: "Website link is unavailable." }, { status: 404 });
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  }

  const type = contentTypeFromMime(asset.mimeType);
  const download = new URL(request.url).searchParams.get("download") === "1" || type === "word" || type === "excel";
  const headers = new Headers({
    "Cache-Control": "private, max-age=300",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(asset.originalName)}`,
    "Content-Type": asset.mimeType ?? "application/octet-stream",
    "Content-Length": String(size),
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
  });
  if (type === "pdf") {
    headers.set("X-Frame-Options", "SAMEORIGIN");
    headers.set("Content-Security-Policy", "frame-ancestors 'self'");
  }
  const rangeHeader = request.method === "GET" ? request.headers.get("range") : null;
  const range = rangeHeader ? parseByteRange(rangeHeader, size) : undefined;
  if (range === null) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}`, "Cache-Control": "private, no-store" } });
  }
  if (range) {
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
    headers.set("Content-Length", String(range.end - range.start + 1));
  }
  if (request.method === "HEAD") return new Response(null, { headers });
  const body = await readObject(asset.storageKey, range).catch(() => null);
  if (!body) return Response.json({ message: "Asset is unavailable." }, { status: 404 });
  return new Response(body, { status: range ? 206 : 200, headers });
}
