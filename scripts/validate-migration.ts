import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const database = new PGlite();
const migration = await readFile("drizzle/0001_clientloop_foundation.sql", "utf8");
const pgliteCompatibleMigration = migration.replace(
  "create extension if not exists pgcrypto;",
  "-- pgcrypto is available in the production PostgreSQL image",
);

await database.exec(pgliteCompatibleMigration);

const tables = await database.query<{ table_name: string }>(`
  select table_name
  from information_schema.tables
  where table_schema = 'public'
  order by table_name
`);

const policies = await database.query<{ count: number }>(`
  select count(*)::int as count
  from pg_policies
  where policyname in ('tenant_isolation', 'agencies_tenant_isolation')
`);

if (tables.rows.length !== 15) {
  throw new Error(`Expected 15 foundation tables, found ${tables.rows.length}.`);
}

if (policies.rows[0]?.count !== 14) {
  throw new Error(`Expected 14 tenant policies, found ${policies.rows[0]?.count ?? 0}.`);
}

process.stdout.write(
  `Validated ${tables.rows.length} tables and ${policies.rows[0].count} tenant policies.\n`,
);

await database.close();
