import { redirect } from "next/navigation";
import { getServerSession } from "@/auth/server";
import { getCompanyContextForIdentity, listCompaniesForAdmin } from "@/data/companies";
import { searchAiWorkspace } from "@/data/ai";
import { ChatWorkspace } from "@/components/chat-workspace";
import type { ChatScope } from "@/data/chat";
import "@/components/chat.css";

export const dynamic = "force-dynamic";
export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ companyId?: string; mode?: string; post?: string }> }) {
  const session = await getServerSession().catch(() => null);
  if (!session) redirect("/login");
  const params = await searchParams;
  const isAdmin = session.user.role === "admin";
  const context = isAdmin ? null : await getCompanyContextForIdentity(session.user.id);
  if (!isAdmin && !context) redirect("/login?error=company-access");
  const companies = isAdmin ? (await listCompaniesForAdmin()).map(({ id, name }) => ({ id, name })) : [{ id: context!.agencyId, name: context!.agencyName }];
  const selected = companies.find((company) => company.id === params.companyId) ?? companies[0];
  // The list route loads all selectable published posts in pages; initial state is intentionally small.
  let initialPosts: Array<{ id: string; title: string }> = [];
  if (context && selected) {
    const scope: ChatScope = { agencyId: context.agencyId, workspaceId: context.workspaceId, companyName: context.agencyName, userId: session.user.id, userName: session.user.name, role: "COMPANY" };
    initialPosts = (await searchAiWorkspace(scope, { kind: "search", query: "" })).items;
  }
  return <ChatWorkspace key={selected?.id ?? "empty"} companies={companies} companyId={selected?.id ?? ""} userId={session.user.id} isAdmin={isAdmin} initialKind={params.mode === "ai" ? "AI" : "COMPANY"} initialPostId={params.post ?? ""} initialPosts={initialPosts} />;
}
