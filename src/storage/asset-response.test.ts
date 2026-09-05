import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./filesystem", () => ({ objectSize: vi.fn(), readObject: vi.fn() }));

import { objectSize, readObject } from "./filesystem";
import { assetResponse } from "./asset-response";

const bytes = Buffer.from("original file bytes");
const asset = { storageKey: "private/file", originalName: "client design.pdf", mimeType: "application/pdf" };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(objectSize).mockResolvedValue(bytes.length);
  vi.mocked(readObject).mockImplementation(async (_key, range) => new Response(range ? bytes.subarray(range.start, range.end + 1) : bytes).body!);
});

describe("private asset responses", () => {
  it("downloads the exact original bytes, with no preview overlay", async () => {
    const response = await assetResponse(new Request("https://app.test/asset?download=1"), { ...asset, mimeType: "image/png" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("attachment;");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
  });
  it("permits PDFs to embed only in the same origin", async () => {
    const response = await assetResponse(new Request("https://app.test/asset"), asset);
    expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(response.headers.get("content-security-policy")).toBe("frame-ancestors 'self'");
    expect(response.headers.get("content-disposition")).toContain("inline;");
  });
  it.each(["application/msword", "application/vnd.ms-excel"])("serves %s as an attachment", async (mimeType) => {
    const response = await assetResponse(new Request("https://app.test/asset"), { ...asset, mimeType });
    expect(response.headers.get("content-disposition")).toContain("attachment;");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
  it("streams only the requested video bytes", async () => {
    const response = await assetResponse(new Request("https://app.test/asset", { headers: { Range: "bytes=3-7" } }), { ...asset, mimeType: "video/mp4" });
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe(`bytes 3-7/${bytes.length}`);
    expect(response.headers.get("content-length")).toBe("5");
    expect(await response.text()).toBe(bytes.subarray(3, 8).toString());
  });
  it("returns 416 without reading an unsatisfiable range", async () => {
    const response = await assetResponse(new Request("https://app.test/asset", { headers: { Range: "bytes=100-" } }), asset);
    expect(response.status).toBe(416);
    expect(readObject).not.toHaveBeenCalled();
  });
  it("answers HEAD without opening a file stream", async () => {
    const response = await assetResponse(new Request("https://app.test/asset", { method: "HEAD" }), asset);
    expect(response.headers.get("content-length")).toBe(String(bytes.length));
    expect(await response.text()).toBe("");
    expect(readObject).not.toHaveBeenCalled();
  });
  it("opens a stored website with its query and fragment intact", async () => {
    vi.mocked(readObject).mockResolvedValue(new Response("https://example.com/path?q=design#v2\r\n").body!);
    const response = await assetResponse(new Request("https://app.test/asset"), { ...asset, mimeType: "text/uri-list" });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://example.com/path?q=design#v2");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("rejects an unsafe stored website URL", async () => {
    vi.mocked(readObject).mockResolvedValue(new Response("javascript:alert(1)").body!);
    const response = await assetResponse(new Request("https://app.test/asset"), { ...asset, mimeType: "text/uri-list" });
    expect(response.status).toBe(404);
    expect(response.headers.has("location")).toBe(false);
  });
});
