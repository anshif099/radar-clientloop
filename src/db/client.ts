import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema";
import * as authSchema from "./auth-schema";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://clientloop:clientloop@localhost:5432/clientloop";

const queryClient = postgres(databaseUrl, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false,
});

export const db = drizzle(queryClient, { schema: { ...schema, ...authSchema } });

export async function withAgency<T>(
  agencyId: string,
  operation: (transaction: typeof db) => Promise<T>,
): Promise<T> {
  return db.transaction(async (transaction) => {
    await transaction.execute(sql`select set_config('app.current_is_super_admin', 'false', true)`);
    await transaction.execute(sql`select set_config('app.current_agency_id', ${agencyId}, true)`);
    return operation(transaction as unknown as typeof db);
  });
}

export async function withPlatformAdmin<T>(
  operation: (transaction: typeof db) => Promise<T>,
): Promise<T> {
  return db.transaction(async (transaction) => {
    await transaction.execute(sql`select set_config('app.current_is_super_admin', 'true', true)`);
    return operation(transaction as unknown as typeof db);
  });
}

export async function closeDatabase() {
  await queryClient.end();
}
