import { expect, it } from "vitest";
import { detectChatUpload } from "./chat-upload";

it.each([
  ["voice.wav", "RIFF1234WAVEdata", "audio/wav"],
  ["voice.mp3", "ID3audio", "audio/mpeg"],
  ["voice.ogg", "OggSdata", "audio/ogg"],
  ["voice.m4a", "1234ftypM4A data", "audio/mp4"],
  ["brief.pdf", "%PDF-1.7", "application/pdf"],
  ["brief.txt", "Please revise the headline", "text/plain"],
  ["table.csv", "name,value\nitem,2", "text/csv"],
])("detects %s by content", (filename, content, mimeType) => {
  expect(detectChatUpload(Buffer.from(content), filename)?.mimeType).toBe(mimeType);
});
it("recognizes browser-recorded WebM audio", () => {
  const bytes = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from("webm")]);
  expect(detectChatUpload(bytes, "voice.webm", "audio/webm;codecs=opus")?.mimeType).toBe("audio/webm");
});
it.each(["image.png", "voice.mp3", "payload.exe", "page.html", "vector.svg"])("rejects disguised or unsupported files: %s", (filename) => {
  expect(detectChatUpload(Buffer.from("<script>attack()</script>"), filename)).toBeNull();
});
it("rejects empty files and binary data disguised as text", () => {
  expect(detectChatUpload(Buffer.alloc(0), "empty.txt")).toBeNull();
  expect(detectChatUpload(Buffer.from([0xff, 0x00]), "binary.txt")).toBeNull();
});
