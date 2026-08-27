import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
const name = process.env.SUPER_ADMIN_NAME?.trim();
const password = process.env.SUPER_ADMIN_PASSWORD;
const secret = process.env.BETTER_AUTH_SECRET;

if (!email || !name || !password) {
  throw new Error("SUPER_ADMIN_EMAIL, SUPER_ADMIN_NAME, and SUPER_ADMIN_PASSWORD are required.");
}

if (!secret || secret.length < 32 || secret.toLowerCase().includes("replace-with")) {
  throw new Error("BETTER_AUTH_SECRET must contain at least 32 random characters.");
}

if (password.length < 12 || password.toLowerCase().includes("replace-with")) {
  throw new Error("SUPER_ADMIN_PASSWORD must be a real password containing at least 12 characters.");
}

const [{ auth }, { closeDatabase, db }, { authUsers }, { eq }] = await Promise.all([
  import("../src/auth/config"),
  import("../src/db/client"),
  import("../src/db/auth-schema"),
  import("drizzle-orm"),
]);

try {
  const existing = await db.select().from(authUsers).where(eq(authUsers.email, email)).limit(1);

  if (existing[0]) {
    if (existing[0].role !== "admin") {
      throw new Error(`An account already exists for ${email}, but it is not a Super Admin.`);
    }
    process.stdout.write(`Super Admin ${email} already exists. No changes made.\n`);
  } else {
    await auth.api.createUser({ body: { email, password, name, role: "admin" } });
    process.stdout.write(`Created Super Admin ${email}.\n`);
  }
} finally {
  await closeDatabase();
}
