export const contentTypes = ["image", "video", "pdf", "word", "excel", "website"] as const;
export type ContentType = typeof contentTypes[number];
export const websiteMimeType = "text/uri-list";

export const contentTypeOptions: Record<ContentType, { label: string; accept: string; help: string; maximumBytes: number }> = {
  image: { label: "Image", accept: ".jpg,.jpeg,.png,.webp,.gif", help: "JPG, PNG, WebP, or GIF · maximum 20 MB", maximumBytes: 20 * 1024 * 1024 },
  video: { label: "Video", accept: ".mp4,.webm,.mov,.m4v", help: "MP4, WebM, MOV, or M4V · maximum 100 MB", maximumBytes: 100 * 1024 * 1024 },
  pdf: { label: "PDF", accept: ".pdf", help: "PDF document · maximum 20 MB", maximumBytes: 20 * 1024 * 1024 },
  word: { label: "Word", accept: ".doc,.docx", help: "DOC or DOCX · maximum 20 MB", maximumBytes: 20 * 1024 * 1024 },
  excel: { label: "Excel", accept: ".xls,.xlsx", help: "XLS or XLSX · maximum 20 MB", maximumBytes: 20 * 1024 * 1024 },
  website: { label: "Website link", accept: "", help: "Enter the full website address, starting with https:// or http://.", maximumBytes: 0 },
};

export function isContentType(value: string): value is ContentType {
  return contentTypes.some((type) => type === value);
}

export function contentTypeFromMime(mimeType: string | null | undefined): ContentType {
  if (mimeType === websiteMimeType) return "website";
  if (mimeType?.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "application/msword" || mimeType?.includes("wordprocessingml")) return "word";
  if (mimeType === "application/vnd.ms-excel" || mimeType?.includes("spreadsheetml")) return "excel";
  return "image";
}

export function normalizeWebsiteUrl(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length > 2048 || [...trimmed].some((character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127)) return null;
  try {
    const url = new URL(trimmed);
    if (!/^https?:\/\//i.test(trimmed) || !["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    return url.href.length <= 2048 ? url.href : null;
  } catch {
    return null;
  }
}

export function assetActionHref(preview: string, contentType: ContentType) {
  return contentType === "website" ? preview : `${preview}?download=1`;
}
