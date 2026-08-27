import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { admin } from "better-auth/plugins";
import { db } from "@/db/client";
import { betterAuthSchema } from "@/db/auth-schema";

const buildTimeSecret = "clientloop-build-time-secret-not-valid-at-runtime";

export const auth = betterAuth({
  appName: "ClientLoop",
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET ?? buildTimeSecret,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: betterAuthSchema,
    transaction: true,
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  plugins: [admin({ defaultRole: "user", adminRoles: ["admin"] })],
});
