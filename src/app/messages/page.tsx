import { redirect } from "next/navigation";
import { getServerSession, isAdminRole } from "@/auth/server";
import { getCompanyContextForIdentity, listCompaniesForAdmin, listCompanyPosterRefs, listPosterRequestsForAdmin, listPostersForAdmin } from "@/data/companies";
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
  const posters = !selected ? [] : isAdmin
    ? [...await listPosterRequestsForAdmin(), ...await listPostersForAdmin()].filter((poster) => poster.companyId === selected.id).map(({ id, title }) => ({ id, title }))
    : await listCompanyPosterRefs(context!);
  const posterId = posters.find((poster) => poster.id === params.post)?.id ?? posters[0]?.id ?? "";
  return <ChatWorkspace key={`${selected?.id ?? "empty"}:${posterId}`} companies={companies} companyId={selected?.id ?? ""} posters={posters} posterId={posterId} userId={session.user.id} isAdmin={isAdmin} />;
}
