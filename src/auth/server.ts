import "server-only";

import { headers } from "next/headers";
export { auth } from "./config";
import { auth } from "./config";

export function assertAuthRuntimeConfigured() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32 || secret.toLowerCase().includes("replace-with")) {
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 random characters.");
  }
}

export async function getServerSession() {
  assertAuthRuntimeConfigured();
  return auth.api.getSession({ headers: await headers() });
}

export async function getRequestSession(request: Request) {
  assertAuthRuntimeConfigured();
  return auth.api.getSession({ headers: request.headers });
}

export async function requireRequestSession(request: Request) {
  const session = await getRequestSession(request);
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

export async function requireRequestSuperAdmin(request: Request) {
  const session = await requireRequestSession(request);
  if (session.user.role !== "admin") throw new Error("FORBIDDEN");
  return session;
}

export async function requireServerSession() {
  const session = await getServerSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

export async function requireSuperAdmin() {
  const session = await requireServerSession();
  if (session.user.role !== "admin") throw new Error("FORBIDDEN");
  return session;
}
