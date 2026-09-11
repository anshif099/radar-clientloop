import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/auth/server", () => ({ requireRequestSuperAdmin: vi.fn() }));
vi.mock("@/data/companies", () => ({ createSubAdmin: vi.fn(), listSubAdmins: vi.fn() }));

import { requireRequestSuperAdmin } from "@/auth/server";
import { createSubAdmin } from "@/data/companies";
import { POST } from "./route";

function request(body: unknown) {
  return new Request("https://app.test/api/v1/admin/sub-admins", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireRequestSuperAdmin).mockResolvedValue({ user: { id: "super" } } as Awaited<ReturnType<typeof requireRequestSuperAdmin>>);
  vi.mocked(createSubAdmin).mockResolvedValue({ id: "sub", name: "Dev User", email: "dev@example.com", position: "Developer", createdAt: new Date() });
});

describe("Sub Admin creation", () => {
  it("creates a positioned Sub Admin as Super Admin", async () => {
    const response = await POST(request({ name: "Dev User", email: "dev@example.com", password: "secure-password", position: "Developer" }));
    expect(response.status).toBe(201);
    expect(createSubAdmin).toHaveBeenCalledWith(expect.objectContaining({ actorId: "super", position: "Developer" }));
  });

  it("rejects an unknown position", async () => {
    expect((await POST(request({ name: "Dev User", email: "dev@example.com", password: "secure-password", position: "Unknown" }))).status).toBe(400);
  });

  it("does not allow Sub Admin authorization", async () => {
    vi.mocked(requireRequestSuperAdmin).mockRejectedValue(new Error("FORBIDDEN"));
    expect((await POST(request({ name: "Dev User", email: "dev@example.com", password: "secure-password", position: "Developer" }))).status).toBe(403);
    expect(createSubAdmin).not.toHaveBeenCalled();
  });
});
