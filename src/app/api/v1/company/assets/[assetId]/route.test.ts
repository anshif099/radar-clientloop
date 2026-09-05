import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@/auth/server", () => ({ getRequestSession: vi.fn() }));
vi.mock("@/data/companies", () => ({ getCompanyAsset: vi.fn(), getCompanyContextForIdentity: vi.fn() }));
vi.mock("@/storage/asset-response", () => ({ assetResponse: vi.fn() }));

import { getRequestSession } from "@/auth/server";
import { getCompanyAsset, getCompanyContextForIdentity } from "@/data/companies";
import { assetResponse } from "@/storage/asset-response";
import { GET } from "./route";

const assetId = "11111111-1111-4111-8111-111111111111";
const context = { agencyId: "company-a", agencyName: "Company A", workspaceId: "workspace-a", workspaceName: "Workspace", profileUserId: "user-a", displayName: "Client" };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getRequestSession).mockResolvedValue({ user: { id: "identity-a", role: "user" } } as Awaited<ReturnType<typeof getRequestSession>>);
  vi.mocked(getCompanyContextForIdentity).mockResolvedValue(context);
});

it("does not stream or redirect an asset outside the authenticated company", async () => {
  vi.mocked(getCompanyAsset).mockResolvedValue(null);
  const response = await GET(new Request(`https://app.test/assets/${assetId}`), { params: Promise.resolve({ assetId }) });
  expect(getCompanyAsset).toHaveBeenCalledWith(context, assetId);
  expect(response.status).toBe(404);
  expect(assetResponse).not.toHaveBeenCalled();
});
it("requires a session before serving videos or redirecting links", async () => {
  vi.mocked(getRequestSession).mockResolvedValue(null);
  expect((await GET(new Request(`https://app.test/assets/${assetId}`), { params: Promise.resolve({ assetId }) })).status).toBe(401);
  expect(getCompanyAsset).not.toHaveBeenCalled();
  expect(assetResponse).not.toHaveBeenCalled();
});
