import { detectUploadType } from "./asset-upload";
import { maxChatBytes } from "./chat";

export function detectChatUpload(bytes: Uint8Array, filename: string, declaredMime = "") {
  if (!bytes.length || bytes.length > maxChatBytes) return null;
  const extension = filename.toLowerCase().split(".").pop() ?? "";
  const prefix = Buffer.from(bytes.subarray(0, 4096));
  const ascii = (start: number, end: number) => prefix.toString("ascii", start, end);
  let audio: string | undefined;
  if (extension === "wav" && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") audio = "audio/wav";
  if (["ogg", "oga"].includes(extension) && ascii(0, 4) === "OggS") audio = "audio/ogg";
  if (extension === "mp3" && (ascii(0, 3) === "ID3" || (bytes[0] === 255 && (bytes[1] & 0xe0) === 0xe0))) audio = "audio/mpeg";
  if (extension === "aac" && bytes[0] === 255 && (bytes[1] & 0xf6) === 0xf0) audio = "audio/aac";
  if (extension === "m4a" && ascii(4, 8) === "ftyp") audio = "audio/mp4";
  const detected = detectUploadType(bytes, filename);
  // MediaRecorder uses a WebM container for voice in Chromium.
  if (detected?.mimeType === "video/webm" && declaredMime.split(";")[0] === "audio/webm") audio = "audio/webm";
  if (audio) return bytes.length <= 25 * 1024 * 1024 ? { mimeType: audio, extension } : null;
  if (detected) return bytes.length <= (detected.contentType === "video" ? maxChatBytes : 20 * 1024 * 1024) ? detected : null;
  if (extension === "zip" && prefix.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) return { mimeType: "application/zip", extension };
  if (["txt", "csv"].includes(extension) && bytes.length <= 20 * 1024 * 1024) {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (text.includes("\0")) return null;
      return { mimeType: extension === "csv" ? "text/csv" : "text/plain", extension };
    } catch { return null; }
  }
  return null;
}
