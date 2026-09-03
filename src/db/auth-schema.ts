import {
  boolean,
  index,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const authTimestamps = {
  createdAt: timestamp("created_at", { mode: "date", fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
    .notNull()
    .defaultNow()
    .onUpdateNow(),
};

export const authUsers = mysqlTable(
  "auth_users",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: text("name").notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    ...authTimestamps,
    role: mysqlEnum("role", ["admin", "user"]).notNull().default("user"),
    banned: boolean("banned").notNull().default(false),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires", { mode: "date", fsp: 3 }),
  },
  (table) => [uniqueIndex("auth_users_email_uq").on(table.email)],
);

export const authSessions = mysqlTable(
  "auth_sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    expiresAt: timestamp("expires_at", { mode: "date", fsp: 3 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    ...authTimestamps,
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    impersonatedBy: varchar("impersonated_by", { length: 36 }),
  },
  (table) => [
    uniqueIndex("auth_sessions_token_uq").on(table.token),
    index("auth_sessions_user_idx").on(table.userId),
  ],
);

export const authAccounts = mysqlTable(
  "auth_accounts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    issuer: varchar("issuer", { length: 255 }).notNull(),
    accountId: varchar("account_id", { length: 255 }).notNull(),
    providerId: varchar("provider_id", { length: 255 }).notNull(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: "date", fsp: 3 }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: "date", fsp: 3 }),
    scope: text("scope"),
    password: text("password"),
    ...authTimestamps,
  },
  (table) => [
    uniqueIndex("auth_accounts_issuer_account_uq").on(table.issuer, table.accountId),
    index("auth_accounts_user_idx").on(table.userId),
  ],
);

export const authVerifications = mysqlTable(
  "auth_verifications",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    identifier: varchar("identifier", { length: 255 }).notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date", fsp: 3 }).notNull(),
    ...authTimestamps,
  },
  (table) => [index("auth_verifications_identifier_idx").on(table.identifier)],
);

export const betterAuthSchema = {
  user: authUsers,
  session: authSessions,
  account: authAccounts,
  verification: authVerifications,
};
