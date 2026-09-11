import { redirect } from "next/navigation";
import { getServerSession, isAdminRole } from "@/auth/server";
import { getCompanyContextForIdentity, listCompaniesForAdmin } from "@/data/companies";
import { ChatWorkspace } from "@/components/chat-workspace";
import "@/components/chat.css";

export const dynamic = "force-dynamic";
export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ companyId?: string; mode?: string; post?: string }> }) {
  const session = await getServerSession().catch(() => null);
  if (!session) redirect("/login");
  const params = await searchParams;
  const isAdmin = isAdminRole(session.user.role);
  const context = isAdmin ? null : await getCompanyContextForIdentity(session.user.id);
  if (!isAdmin && !context) redirect("/login?error=company-access");
  const companies = isAdmin ? (await listCompaniesForAdmin()).map(({ id, name }) => ({ id, name })) : [{ id: context!.agencyId, name: context!.agencyName }];
  const selected = companies.find((company) => company.id === params.companyId) ?? companies[0];
  return <ChatWorkspace key={selected?.id ?? "empty"} companies={companies} companyId={selected?.id ?? ""} userId={session.user.id} isAdmin={isAdmin} />;
}
