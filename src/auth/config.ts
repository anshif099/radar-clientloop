import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { admin } from "better-auth/plugins";
import { db } from "@/db/client";
import { betterAuthSchema } from "@/db/auth-schema";

const buildTimeSecret = "clientloop-build-time-secret-not-valid-at-runtime";
const appOrigin = new URL(
  process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
).origin;

export const auth = betterAuth({
  appName: "ClientLoop",
  // Better Auth treats a pathname in baseURL as its API route prefix. Keep
  // deployment URLs such as https://example.com/login from hiding /api/auth.
  baseURL: appOrigin,
  secret: process.env.BETTER_AUTH_SECRET ?? buildTimeSecret,
  database: drizzleAdapter(db, {
    provider: "mysql",
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
