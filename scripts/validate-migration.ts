import { readFile, readdir } from "node:fs/promises";

const migrationFiles = (await readdir("drizzle"))
  .filter((file) => file.endsWith(".sql"))
  .sort((left, right) => left.localeCompare(right));
const migrations = (
  await Promise.all(migrationFiles.map((file) => readFile(`drizzle/${file}`, "utf8")))
).join("\n");

const requiredTables = [
  "auth_users",
  "auth_sessions",
  "auth_accounts",
  "auth_verifications",
  "agencies",
  "users",
  "agency_memberships",
  "client_workspaces",
  "workspace_memberships",
  "portal_access_tokens",
  "divisions",
  "work_items",
  "work_item_versions",
  "assets",
  "version_assets",
  "review_decisions",
  "feedback_entries",
  "audit_events",
  "outbox_events",
];

for (const table of requiredTables) {
  if (!new RegExp(`CREATE\\s+TABLE\\s+${table}\\b`, "i").test(migrations)) {
    throw new Error(`MySQL migration does not create required table: ${table}`);
  }
}

const forbiddenPostgresSyntax = [
  /pgcrypto/i,
  /row\s+level\s+security/i,
  /\btimestamptz\b/i,
  /\bjsonb\b/i,
  /\bplpgsql\b/i,
  /\bset_config\b/i,
  /\bcreate\s+policy\b/i,
];
for (const pattern of forbiddenPostgresSyntax) {
  if (pattern.test(migrations)) {
    throw new Error(`PostgreSQL-only syntax remains in MySQL migrations: ${pattern}`);
  }
}

if (!/CREATE\s+TRIGGER\s+audit_events_immutable_update/i.test(migrations)
  || !/CREATE\s+TRIGGER\s+audit_events_immutable_delete/i.test(migrations)) {
  throw new Error("Audit event immutability triggers are missing.");
}

const [clientSource, authSource, repositorySource] = await Promise.all([
  readFile("src/db/client.ts", "utf8"),
  readFile("src/auth/config.ts", "utf8"),
  readFile("src/data/companies.ts", "utf8"),
]);

if (!clientSource.includes("drizzle-orm/mysql2") || !authSource.includes('provider: "mysql"')) {
  throw new Error("The runtime database or Better Auth adapter is not configured for MySQL.");
}
if (repositorySource.includes(".returning(")) {
  throw new Error("A PostgreSQL-style RETURNING query remains in the repository.");
}

for (const tenantPredicate of [
  "eq(workItems.agencyId, context.agencyId)",
  "eq(workItems.workspaceId, context.workspaceId)",
  "eq(assets.agencyId, context.agencyId)",
  "eq(assets.workspaceId, context.workspaceId)",
]) {
  if (!repositorySource.includes(tenantPredicate)) {
    throw new Error(`A required company-scope predicate is missing: ${tenantPredicate}`);
  }
}

process.stdout.write(
  `Validated ${migrationFiles.length} MariaDB/MySQL migrations, ${requiredTables.length} tables, auth configuration, audit immutability, and company-scope query guards.\n`,
);
