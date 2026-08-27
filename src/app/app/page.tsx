import { redirect } from "next/navigation";
import { getServerSession } from "@/auth/server";

export const dynamic = "force-dynamic";

export default async function AppRouterPage() {
  const session = await getServerSession().catch(() => null);
  if (!session) redirect("/login");
  redirect(session.user.role === "admin" ? "/admin" : "/company");
}
