import { redirect } from "next/navigation";
import { getServerSession } from "@/auth/server";
import { AdminDashboard } from "@/components/admin-dashboard";
import { listCompaniesForAdmin } from "@/data/companies";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getServerSession().catch(() => null);
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/company");
  const companies = (await listCompaniesForAdmin()).map((company) => ({
    ...company,
    createdAt: company.createdAt.toISOString(),
  }));
  return <AdminDashboard initialCompanies={companies} adminName={session.user.name} />;
}
