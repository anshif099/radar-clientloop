import { redirect } from "next/navigation";
import { getServerSession, isAdminRole } from "@/auth/server";
import { ReviewApp } from "@/components/review-app";
import { getCompanyContextForIdentity, listCompanyPosters, listCompanyProjects } from "@/data/companies";

export const dynamic = "force-dynamic";

export default async function CompanyPage() {
  const session = await getServerSession().catch(() => null);
  if (!session) redirect("/login");
  if (isAdminRole(session.user.role)) redirect("/admin");
  const context = await getCompanyContextForIdentity(session.user.id);
  if (!context) redirect("/login?error=company-access");
  const [posters, projects] = await Promise.all([
    listCompanyPosters(context),
    listCompanyProjects(context),
  ]);
  return (
    <ReviewApp
      initialItems={posters}
      initialProjects={projects}
      companyName={context.agencyName}
      viewerName={context.displayName}
    />
  );
}
