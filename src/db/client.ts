import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";
import * as authSchema from "./auth-schema";

const databaseUrl =
  process.env.DATABASE_URL ?? "mysql://clientloop:clientloop@127.0.0.1:3306/clientloop";

const queryPool = mysql.createPool({
  uri: databaseUrl,
  connectionLimit: 10,
  enableKeepAlive: true,
  waitForConnections: true,
  timezone: "Z",
});

export const db = drizzle({
  client: queryPool,
  schema: { ...schema, ...authSchema },
  mode: "default",
});

/**
 * MariaDB does not provide PostgreSQL-style row-level security. Company-facing
 * repositories must include both agencyId and workspaceId in every predicate.
 * This wrapper keeps those operations transactional and rejects an empty scope.
 */
export async function withAgency<T>(
  agencyId: string,
  operation: (transaction: typeof db) => Promise<T>,
): Promise<T> {
  if (!agencyId) throw new Error("A company scope is required.");
  return db.transaction((transaction) => operation(transaction as unknown as typeof db));
}

export async function withPlatformAdmin<T>(
  operation: (transaction: typeof db) => Promise<T>,
): Promise<T> {
  return db.transaction((transaction) => operation(transaction as unknown as typeof db));
}

export async function closeDatabase() {
  await queryPool.end();
}
