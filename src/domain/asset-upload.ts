import { contentTypeOptions, type ContentType } from "./asset-types";

function startsWith(bytes: Uint8Array, signature: number[]) {
  return bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte);
}

function zipHasEntry(bytes: Uint8Array, entry: string) {
  // Inspect directory entries without inflating untrusted archives.
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  while (offset >= 0 && offset + 46 <= buffer.length) {
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const end = offset + 46 + nameLength + extraLength + commentLength;
    if (end > buffer.length) return false;
    if (buffer.toString("utf8", offset + 46, offset + 46 + nameLength) === entry) return true;
    offset = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), end);
  }
  return false;
}

export function detectUploadType(bytes: Uint8Array, filename: string) {
  const extension = filename.toLowerCase().split(".").pop();
  const prefix = Buffer.from(bytes.subarray(0, 4096));
  if (["jpg", "jpeg"].includes(extension ?? "") && startsWith(bytes, [0xff, 0xd8, 0xff])) return { mimeType: "image/jpeg", extension: "jpg", contentType: "image" as const };
  if (extension === "png" && startsWith(bytes, [137, 80, 78, 71, 13, 10, 26, 10])) return { mimeType: "image/png", extension, contentType: "image" as const };
  if (extension === "gif" && /^(GIF87a|GIF89a)/.test(prefix.toString("ascii", 0, 6))) return { mimeType: "image/gif", extension, contentType: "image" as const };
  if (extension === "webp" && prefix.toString("ascii", 0, 4) === "RIFF" && prefix.toString("ascii", 8, 12) === "WEBP") return { mimeType: "image/webp", extension, contentType: "image" as const };
  if (extension === "pdf" && prefix.toString("ascii", 0, 5) === "%PDF-") return { mimeType: "application/pdf", extension, contentType: "pdf" as const };
  if (["mp4", "m4v", "mov"].includes(extension ?? "") && bytes.length >= 12 && prefix.toString("ascii", 4, 8) === "ftyp") {
    return { mimeType: extension === "mov" ? "video/quicktime" : "video/mp4", extension: extension!, contentType: "video" as const };
  }
  if (extension === "webm" && startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]) && prefix.includes(Buffer.from("webm"))) return { mimeType: "video/webm", extension, contentType: "video" as const };
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) && zipHasEntry(bytes, "[Content_Types].xml")) {
    if (extension === "docx" && zipHasEntry(bytes, "word/document.xml")) return { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extension, contentType: "word" as const };
    if (extension === "xlsx" && zipHasEntry(bytes, "xl/workbook.xml")) return { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension, contentType: "excel" as const };
  }
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (extension === "doc" && buffer.includes(Buffer.from("WordDocument\0", "utf16le"))) return { mimeType: "application/msword", extension, contentType: "word" as const };
    if (extension === "xls" && ["Workbook\0", "Book\0"].some((name) => buffer.includes(Buffer.from(name, "utf16le")))) return { mimeType: "application/vnd.ms-excel", extension, contentType: "excel" as const };
  }
  return null;
}

export function validateUploadSize(size: number, contentType: ContentType) {
  return size > 0 && size <= contentTypeOptions[contentType].maximumBytes;
}
