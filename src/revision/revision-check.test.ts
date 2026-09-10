import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));
vi.mock("@/storage/filesystem", () => ({ readObject: vi.fn() }));

import { readObject } from "@/storage/filesystem";
import { analyzeRevision } from "./revision-check";

const baseSource = {
  posterId: "33333333-3333-4333-8333-333333333333",
  title: "Campaign",
  requestedVersion: { versionNumber: 2, note: "Client review", asset: { storageKey: "before", originalName: "v2.png", mimeType: "image/png", sizeBytes: 10 } },
  currentVersion: { versionNumber: 3, note: "Updated", asset: { storageKey: "after", originalName: "v3.png", mimeType: "image/png", sizeBytes: 10 } },
  feedback: ["Make the logo larger"],
};

function stream(bytes: Buffer) {
  return new Response(new Uint8Array(bytes)).body!;
}

beforeEach(() => vi.resetAllMocks());

describe("deterministic revision comparison", () => {
  it("marks every request missing when both versions are identical", async () => {
    const image = await sharp({ create: { width: 100, height: 100, channels: 3, background: "white" } }).png().toBuffer();
    vi.mocked(readObject).mockImplementation(async () => stream(image));

    const result = await analyzeRevision(baseSource);

    expect(result.verdict).toBe("NEEDS_ATTENTION");
    expect(result.requirements[0]).toEqual(expect.objectContaining({ status: "MISSING" }));
    expect(result.visualChanges[0]).toContain("same bytes");
    expect(result.compared).toEqual({ fromVersion: 2, toVersion: 3 });
  });

  it("passes a requested image dimension when the revised image matches it", async () => {
    const before = await sharp({ create: { width: 100, height: 100, channels: 3, background: "white" } }).png().toBuffer();
    const after = await sharp({ create: { width: 200, height: 100, channels: 3, background: "black" } }).png().toBuffer();
    vi.mocked(readObject).mockImplementation(async (key) => stream(key === "before" ? before : after));

    const result = await analyzeRevision({ ...baseSource, feedback: ["Export at 200 x 100 pixels"] });

    expect(result.verdict).toBe("READY");
    expect(result.requirements[0]).toEqual(expect.objectContaining({ status: "MET", evidence: expect.stringContaining("200 x 100px") }));
  });

  it("leaves subjective visual requests for human confirmation", async () => {
    const before = await sharp({ create: { width: 100, height: 100, channels: 3, background: "white" } }).png().toBuffer();
    const after = await sharp({ create: { width: 100, height: 100, channels: 3, background: "black" } }).png().toBuffer();
    vi.mocked(readObject).mockImplementation(async (key) => stream(key === "before" ? before : after));

    const result = await analyzeRevision(baseSource);

    expect(result.verdict).toBe("UNCERTAIN");
    expect(result.requirements[0]).toEqual(expect.objectContaining({ status: "UNCERTAIN" }));
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining("not an AI review")]));
  });
});
