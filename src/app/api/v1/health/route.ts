import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { verifyPosterStorage } from "@/storage/filesystem";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await Promise.all([db.execute(sql`SELECT 1`), verifyPosterStorage()]);
    return Response.json(
      {
        status: "ok",
        service: "clientloop-web",
        checks: { database: "ok", posterStorage: "ok" },
        timestamp: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Health check failed", error);
    return Response.json(
      {
        status: "unavailable",
        service: "clientloop-web",
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
