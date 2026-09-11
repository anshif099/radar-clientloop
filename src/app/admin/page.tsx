import { redirect } from "next/navigation";
import { getServerSession, isAdminRole } from "@/auth/server";
import { AdminDashboard } from "@/components/admin-dashboard";
import { getSubAdminPosition, listCompaniesForAdmin, listPostersForAdmin, listProjectsForAdmin, listSubAdmins } from "@/data/companies";
import { posterStorageConfigured } from "@/storage/filesystem";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getServerSession().catch(() => null);
  if (!session) redirect("/login");
  if (!isAdminRole(session.user.role)) redirect("/company");
  const isSuperAdmin = session.user.role === "admin";
  const [companyRows, projectRows, posters, subAdmins, adminPosition] = await Promise.all([
    listCompaniesForAdmin(),
    listProjectsForAdmin(),
    listPostersForAdmin(),
    isSuperAdmin ? listSubAdmins() : Promise.resolve([]),
    isSuperAdmin ? Promise.resolve("Super Admin") : getSubAdminPosition(session.user.id),
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
      adminPosition={adminPosition ?? "Sub Admin"}
      isSuperAdmin={isSuperAdmin}
      initialSubAdmins={subAdmins.map((subAdmin) => ({ ...subAdmin, createdAt: subAdmin.createdAt.toISOString() }))}
      posterStorageConfigured={posterStorageConfigured()}
    />
  );
}
