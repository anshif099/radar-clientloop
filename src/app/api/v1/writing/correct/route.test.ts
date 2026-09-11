import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/auth/chat", () => ({ assertChatOrigin: vi.fn() }));
vi.mock("@/auth/server", () => ({ requireRequestSession: vi.fn() }));
import { requireRequestSession } from "@/auth/server";
import { POST } from "./route";

function request(body: unknown) {
  return new Request("https://app.test/api/v1/writing/correct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireRequestSession).mockResolvedValue({ user: { id: "user" } } as Awaited<ReturnType<typeof requireRequestSession>>);
});

describe("writing correction", () => {
  it("returns a structured correction for an authenticated user", async () => {
    const response = await POST(request({ text: "this are aplication", context: "upload-note" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({ correctedText: "This is application", language: "English or Manglish" }));
  });

  it("returns live local-dictionary suggestions", async () => {
    const response = await POST(request({ text: "appl", context: "upload-note", mode: "suggest" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ suggestions: expect.arrayContaining(["apple"]) });
  });

  it("rejects empty text", async () => {
    expect((await POST(request({ text: "" }))).status).toBe(400);
  });

  it("requires authentication", async () => {
    vi.mocked(requireRequestSession).mockRejectedValue(new Error("UNAUTHENTICATED"));
    expect((await POST(request({ text: "Check me" }))).status).toBe(401);
  });
});
