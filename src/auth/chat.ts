import "server-only";
import { requireRequestSession } from "@/auth/server";
import { getCompanyContextForIdentity, getCompanyForAdmin } from "@/data/companies";
import type { ChatScope } from "@/data/chat";

export async function requireChatScope(request: Request): Promise<ChatScope> {
  const session = await requireRequestSession(request);
  const companyId = new URL(request.url).searchParams.get("companyId");
  if (session.user.role === "admin") {
    const company = companyId ? await getCompanyForAdmin(companyId) : null;
    if (!company) throw new Error("NOT_FOUND");
    return { agencyId: company.id, workspaceId: company.workspaceId, companyName: company.name, userId: session.user.id, userName: session.user.name, role: "ADMIN" };
  }
  const context = await getCompanyContextForIdentity(session.user.id);
  if (!context || (companyId && companyId !== context.agencyId)) throw new Error("FORBIDDEN");
  return { agencyId: context.agencyId, workspaceId: context.workspaceId, companyName: context.agencyName, userId: session.user.id, userName: session.user.name, role: "COMPANY" };
}
export function assertChatOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = [new URL(request.url).origin, process.env.NEXT_PUBLIC_APP_URL, process.env.BETTER_AUTH_URL].filter(Boolean);
  if ((origin && !allowed.includes(origin)) || request.headers.get("sec-fetch-site") === "cross-site") throw new Error("FORBIDDEN");
}
export class ChatInputError extends Error {}
export function chatError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  const status = error instanceof ChatInputError ? 400 : code === "UNAUTHENTICATED" ? 401 : code === "FORBIDDEN" ? 403 : code === "NOT_FOUND" ? 404 : 500;
  if (status === 500) console.error("Chat operation failed", error);
  return Response.json({ message: status === 400 ? code : status === 401 ? "Please sign in." : status === 403 ? "You cannot access this company conversation." : status === 404 ? "Conversation or file not found." : "Chat is temporarily unavailable. Please try again." }, { status, headers: { "Cache-Control": "private, no-store" } });
}
