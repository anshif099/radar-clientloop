import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run migrations.");
}

const sql = postgres(databaseUrl, { max: 1, prepare: false });
const migrationsDirectory = path.resolve("drizzle");

await sql`
  create table if not exists clientloop_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )
`;

const files = (await readdir(migrationsDirectory))
  .filter((file) => file.endsWith(".sql"))
  .sort((left, right) => left.localeCompare(right));

for (const file of files) {
  const alreadyApplied = await sql<{ exists: boolean }[]>`
    select exists(select 1 from clientloop_migrations where name = ${file}) as exists
  `;

  if (alreadyApplied[0]?.exists) continue;

  const migration = await readFile(path.join(migrationsDirectory, file), "utf8");

  await sql.begin(async (transaction) => {
    await transaction.unsafe(migration);
    await transaction`insert into clientloop_migrations (name) values (${file})`;
  });

  process.stdout.write(`Applied ${file}\n`);
}

await sql.end();
