import { redirect } from "next/navigation";
import { getServerSession } from "@/auth/server";
import { ReviewApp } from "@/components/review-app";
import { getCompanyContextForIdentity, listCompanyPosters } from "@/data/companies";

export const dynamic = "force-dynamic";

export default async function CompanyPage() {
  const session = await getServerSession().catch(() => null);
  if (!session) redirect("/login");
  if (session.user.role === "admin") redirect("/admin");
  const context = await getCompanyContextForIdentity(session.user.id);
  if (!context) redirect("/login?error=company-access");
  const posters = await listCompanyPosters(context);
  return <ReviewApp initialItems={posters} companyName={context.agencyName} viewerName={context.displayName} />;
}
