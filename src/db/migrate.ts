import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import mysql, { type RowDataPacket } from "mysql2/promise";

config({ path: ".env.production.local" });
config({ path: ".env.local" });
config({ path: ".env" });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run migrations.");
}
if (!databaseUrl.startsWith("mysql://") && !databaseUrl.startsWith("mysqls://")) {
  throw new Error("DATABASE_URL must be a MySQL/MariaDB connection URL.");
}

const connection = await mysql.createConnection({
  uri: databaseUrl,
  multipleStatements: true,
  timezone: "Z",
});
const migrationsDirectory = path.resolve("drizzle");

try {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS clientloop_migrations (
      name VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const files = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));

  for (const file of files) {
    const [rows] = await connection.execute<(RowDataPacket & { applied: number })[]>(
      "SELECT EXISTS(SELECT 1 FROM clientloop_migrations WHERE name = ?) AS applied",
      [file],
    );
    if (rows[0]?.applied) continue;

    const migration = await readFile(path.join(migrationsDirectory, file), "utf8");
    await connection.query(migration);
    await connection.execute("INSERT INTO clientloop_migrations (name) VALUES (?)", [file]);
    process.stdout.write(`Applied ${file}\n`);
  }
} finally {
  await connection.end();
}
