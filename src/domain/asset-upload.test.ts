import { describe, expect, it } from "vitest";
import { detectUploadType, validateUploadSize } from "./asset-upload";
import { contentTypeFromMime, normalizeWebsiteUrl } from "./asset-types";

function officeArchive(entries: string[]) {
  return Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), ...entries.map((name) => {
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50);
    header.writeUInt16LE(Buffer.byteLength(name), 28);
    return Buffer.concat([header, Buffer.from(name)]);
  })]);
}

describe("uploaded file identification", () => {
  it.each([
    ["photo.JPG", Buffer.from([0xff, 0xd8, 0xff]), "image"],
    ["photo.png", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), "image"],
    ["animation.gif", Buffer.from("GIF89a"), "image"],
    ["photo.webp", Buffer.from("RIFF1234WEBP"), "image"],
    ["document.pdf", Buffer.from("%PDF-1.7"), "pdf"],
    ["clip.mp4", Buffer.from("\0\0\0\x18ftypisom"), "video"],
    ["clip.mov", Buffer.from("\0\0\0\x18ftypqt  "), "video"],
    ["clip.m4v", Buffer.from("\0\0\0\x18ftypM4V "), "video"],
    ["clip.webm", Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from("webm")]), "video"],
    ["document.docx", officeArchive(["[Content_Types].xml", "word/document.xml"]), "word"],
    ["sheet.xlsx", officeArchive(["[Content_Types].xml", "xl/workbook.xml"]), "excel"],
    ["document.doc", Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.from("WordDocument\0", "utf16le")]), "word"],
    ["sheet.xls", Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.from("Workbook\0", "utf16le")]), "excel"],
  ] as const)("identifies %s by content and filename", (filename, bytes, type) => {
    const result = detectUploadType(bytes, filename);
    expect(result?.contentType).toBe(type);
    expect(contentTypeFromMime(result?.mimeType)).toBe(type);
  });

  it("rejects renamed scripts, mismatched Office types, and incomplete archives", () => {
    expect(detectUploadType(Buffer.from("<script>alert(1)</script>"), "image.jpg")).toBeNull();
    expect(detectUploadType(Buffer.from("%PDF-1.7"), "image.jpg")).toBeNull();
    expect(detectUploadType(officeArchive(["[Content_Types].xml", "word/document.xml"]), "sheet.xlsx")).toBeNull();
    expect(detectUploadType(Buffer.from("PK\x03\x04word/document.xml"), "document.docx")).toBeNull();
    expect(detectUploadType(Buffer.from(""), "document.pdf")).toBeNull();
  });

  it("applies the selected type's size limit before reading file bytes", () => {
    expect(validateUploadSize(0, "image")).toBe(false);
    expect(validateUploadSize(20 * 1024 * 1024, "pdf")).toBe(true);
    expect(validateUploadSize(20 * 1024 * 1024 + 1, "excel")).toBe(false);
    expect(validateUploadSize(100 * 1024 * 1024, "video")).toBe(true);
    expect(validateUploadSize(100 * 1024 * 1024 + 1, "video")).toBe(false);
  });
});

describe("website URLs", () => {
  it("preserves query strings and fragments through storage normalization", () => {
    expect(normalizeWebsiteUrl(" https://example.com/review?q=a%20b#design\r\n")).toBe("https://example.com/review?q=a%20b#design");
    expect(normalizeWebsiteUrl("http://example.com")).toBe("http://example.com/");
  });
  it.each(["javascript:alert(1)", "data:text/html,test", "file:///etc/passwd", "//example.com", "https://user:password@example.com", "https://exa\nmple.com", "https://example.com/a b", `https://example.com/${"a".repeat(2048)}`])("rejects invalid website URL %s", (url) => {
    expect(normalizeWebsiteUrl(url)).toBeNull();
  });
});
