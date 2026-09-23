import { config } from "dotenv";

config({ path: ".env.production.local" });
config({ path: ".env.local" });
config({ path: ".env" });

const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.RESET_SUPER_ADMIN_PASSWORD;

if (!email || !password || password.length < 12 || password.length > 128) {
  throw new Error("Set SUPER_ADMIN_EMAIL and RESET_SUPER_ADMIN_PASSWORD (12-128 characters) before resetting.");
}

const [{ auth }, { closeDatabase, db }, { authAccounts, authSessions, authUsers }, { and, eq }] = await Promise.all([
  import("../src/auth/config"),
  import("../src/db/client"),
  import("../src/db/auth-schema"),
  import("drizzle-orm"),
]);

try {
  const [user] = await db.select({ id: authUsers.id, role: authUsers.role, banned: authUsers.banned })
    .from(authUsers).where(eq(authUsers.email, email)).limit(1);
  if (!user || user.role !== "admin" || user.banned) {
    throw new Error("An active Super Admin with SUPER_ADMIN_EMAIL was not found. No changes made.");
  }

  const accountFilter = and(
    eq(authAccounts.userId, user.id),
    eq(authAccounts.accountId, user.id),
    eq(authAccounts.providerId, "credential"),
    eq(authAccounts.issuer, "local:credential"),
  );
  const [account] = await db.select({ id: authAccounts.id }).from(authAccounts).where(accountFilter).limit(1);
  if (!account) throw new Error("The Super Admin credential account was not found. No changes made.");

  const hash = await (await auth.$context).password.hash(password);
  await db.transaction(async (transaction) => {
    await transaction.update(authAccounts).set({ password: hash, updatedAt: new Date() }).where(accountFilter);
    await transaction.delete(authSessions).where(eq(authSessions.userId, user.id));
  });
  process.stdout.write(`Reset password and revoked sessions for ${email}.\n`);
} finally {
  await closeDatabase();
}
