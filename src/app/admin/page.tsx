import { redirect } from "next/navigation";
import { getServerSession } from "@/auth/server";
import { AdminDashboard } from "@/components/admin-dashboard";
import { listCompaniesForAdmin, listProjectsForAdmin } from "@/data/companies";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getServerSession().catch(() => null);
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/company");
  const [companyRows, projectRows] = await Promise.all([
    listCompaniesForAdmin(),
    listProjectsForAdmin(),
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
      adminName={session.user.name}
      posterStorageConfigured={Boolean(
        process.env.S3_BUCKET
        && process.env.S3_ENDPOINT
        && process.env.S3_ACCESS_KEY_ID
        && process.env.S3_SECRET_ACCESS_KEY,
      )}
    />
  );
}
