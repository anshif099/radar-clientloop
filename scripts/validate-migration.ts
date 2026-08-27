import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { admin } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/pglite";
import { betterAuthSchema } from "../src/db/auth-schema";

const database = new PGlite();

try {
  const migrationFiles = (await readdir("drizzle"))
    .filter((file) => file.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));

  for (const file of migrationFiles) {
    const migration = await readFile(`drizzle/${file}`, "utf8");
    const pgliteCompatibleMigration = migration.replace(
      "create extension if not exists pgcrypto;",
      "-- pgcrypto is available in the production PostgreSQL image",
    );
    await database.exec(pgliteCompatibleMigration);
  }

const tables = await database.query<{ table_name: string }>(`
  select table_name
  from information_schema.tables
  where table_schema = 'public'
  order by table_name
`);

  const policies = await database.query<{ count: number }>(`
    select count(*)::int as count
    from pg_policies
    where schemaname = 'public'
  `);

const authTables = await database.query<{ table_name: string }>(`
  select table_name
  from information_schema.tables
  where table_schema = 'auth'
  order by table_name
`);

  if (tables.rows.length !== 15) {
    throw new Error(`Expected 15 foundation tables, found ${tables.rows.length}.`);
  }

  if (authTables.rows.length !== 4) {
    throw new Error(`Expected 4 authentication tables, found ${authTables.rows.length}.`);
  }

  if (policies.rows[0]?.count !== 15) {
    throw new Error(`Expected 15 tenant policies, found ${policies.rows[0]?.count ?? 0}.`);
  }

  const tenantA = "11111111-1111-4111-8111-111111111111";
  const tenantB = "22222222-2222-4222-8222-222222222222";
  await database.exec(`
    select set_config('app.current_is_super_admin', 'true', false);
    insert into agencies (id, name, slug) values
      ('${tenantA}', 'Tenant A', 'tenant-a'),
      ('${tenantB}', 'Tenant B', 'tenant-b');
    create role clientloop_tenant_test noinherit;
    grant usage on schema public, app to clientloop_tenant_test;
    grant select on agencies to clientloop_tenant_test;
    grant insert on client_workspaces to clientloop_tenant_test;
    select set_config('app.current_is_super_admin', 'false', false);
    select set_config('app.current_agency_id', '${tenantA}', false);
    set role clientloop_tenant_test;
  `);
  const visibleAgencies = await database.query<{ id: string }>("select id from agencies order by id");
  if (visibleAgencies.rows.length !== 1 || visibleAgencies.rows[0]?.id !== tenantA) {
    throw new Error("Row-level security did not isolate the active tenant.");
  }

  let crossTenantWriteWasBlocked = false;
  try {
    await database.exec(`insert into client_workspaces (agency_id, name, slug) values ('${tenantB}', 'Wrong tenant', 'wrong-tenant')`);
  } catch {
    crossTenantWriteWasBlocked = true;
  }
  if (!crossTenantWriteWasBlocked) {
    throw new Error("Row-level security allowed a cross-tenant write.");
  }

  await database.exec("reset role; select set_config('app.current_is_super_admin', 'true', false)");
  const validationDb = drizzle(database, { schema: betterAuthSchema });
  const validationAuth = betterAuth({
    baseURL: "http://localhost:3000",
    secret: "migration-validation-secret-with-more-than-32-characters",
    database: drizzleAdapter(validationDb, {
      provider: "pg",
      schema: betterAuthSchema,
      transaction: true,
    }),
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12 },
    plugins: [admin({ defaultRole: "user", adminRoles: ["admin"] })],
  });
  const createdAdmin = await validationAuth.api.createUser({
    body: {
      name: "Migration Validator",
      email: "validator@example.invalid",
      password: "Validation-Password-Only-42",
      role: "admin",
    },
  });
  const signedIn = await validationAuth.api.signInEmail({
    body: { email: "validator@example.invalid", password: "Validation-Password-Only-42" },
  });
  if (signedIn.user.id !== createdAdmin.user.id || signedIn.user.role !== "admin") {
    throw new Error("Authentication schema did not support Super Admin creation and login.");
  }

  process.stdout.write(
    `Validated ${tables.rows.length} application tables, ${authTables.rows.length} auth tables, ${policies.rows[0].count} tenant policies, cross-tenant isolation, and credential login.\n`,
  );
} finally {
  await database.close();
}
