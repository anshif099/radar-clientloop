import { redirect } from "next/navigation";
import { getServerSession } from "@/auth/server";
import { AdminDashboard } from "@/components/admin-dashboard";
import { listCompaniesForAdmin, listPostersForAdmin, listProjectsForAdmin } from "@/data/companies";
import { posterStorageConfigured } from "@/storage/filesystem";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getServerSession().catch(() => null);
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/company");
  const [companyRows, projectRows, posters] = await Promise.all([
    listCompaniesForAdmin(),
    listProjectsForAdmin(),
    listPostersForAdmin(),
  ]);
  const companies = companyRows.map((company) => ({
    ...company,
    createdAt: company.createdAt.toISOString(),
  }));
  const projects = projectRows.map((project) => ({
    ...project,
    createdAt: project.createdAt.toISOString(),
  }));
  return (
    <AdminDashboard
      initialCompanies={companies}
      initialProjects={projects}
      initialPosters={posters}
      adminName={session.user.name}
      posterStorageConfigured={posterStorageConfigured()}
    />
  );
}
