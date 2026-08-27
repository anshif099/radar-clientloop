import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const agencyStatus = pgEnum("agency_status", ["ACTIVE", "SUSPENDED", "CLOSED"]);
export const membershipStatus = pgEnum("membership_status", ["INVITED", "ACTIVE", "DISABLED"]);
export const roleKey = pgEnum("role_key", ["ADMIN", "PROJECT_MANAGER", "CONTRIBUTOR", "SOCIAL"]);
export const workspaceStatus = pgEnum("workspace_status", ["ACTIVE", "ARCHIVED"]);
export const workItemStatus = pgEnum("work_item_status", [
  "DRAFT",
  "AWAITING_CLIENT_REVIEW",
  "REVISION_REQUIRED",
  "APPROVED",
  "ARCHIVED",
]);
export const versionStatus = pgEnum("version_status", ["DRAFT", "PROCESSING", "READY", "PUBLISHED"]);
export const assetStatus = pgEnum("asset_status", [
  "PENDING_UPLOAD",
  "QUARANTINED",
  "PROCESSING",
  "READY",
  "REJECTED",
  "DELETED",
]);
export const reviewDecision = pgEnum("review_decision", ["APPROVE", "REQUEST_CHANGES", "REJECT"]);
export const feedbackKind = pgEnum("feedback_kind", ["TEXT", "VOICE", "REFERENCE_FILE", "REFERENCE_URL"]);
export const visibility = pgEnum("visibility", ["CLIENT_VISIBLE", "INTERNAL_ONLY"]);
export const outboxStatus = pgEnum("outbox_status", ["PENDING", "PROCESSING", "DELIVERED", "FAILED"]);

export const agencies = pgTable(
  "agencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    status: agencyStatus("status").notNull().default("ACTIVE"),
    timezone: varchar("timezone", { length: 64 }).notNull().default("Asia/Kolkata"),
    locale: varchar("locale", { length: 16 }).notNull().default("en-IN"),
    brand: jsonb("brand").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [uniqueIndex("agencies_slug_uq").on(table.slug)],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identityProviderId: varchar("identity_provider_id", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    displayName: varchar("display_name", { length: 160 }).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_identity_provider_id_uq").on(table.identityProviderId)],
);

export const agencyMemberships = pgTable(
  "agency_memberships",
  {
    agencyId: uuid("agency_id").notNull().references(() => agencies.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    role: roleKey("role").notNull(),
    status: membershipStatus("status").notNull().default("INVITED"),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.agencyId, table.userId] }),
    index("agency_memberships_user_idx").on(table.userId),
  ],
);

export const clientWorkspaces = pgTable(
  "client_workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id),
    name: varchar("name", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 110 }).notNull(),
    status: workspaceStatus("status").notNull().default("ACTIVE"),
    showcaseConsent: boolean("showcase_consent").notNull().default(false),
    requireOtp: boolean("require_otp").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("client_workspaces_agency_slug_uq").on(table.agencyId, table.slug),
    uniqueIndex("client_workspaces_agency_id_uq").on(table.agencyId, table.id),
    index("client_workspaces_agency_status_idx").on(table.agencyId, table.status),
  ],
);

export const workspaceMemberships = pgTable(
  "workspace_memberships",
  {
    agencyId: uuid("agency_id").notNull().references(() => agencies.id),
    workspaceId: uuid("workspace_id").notNull().references(() => clientWorkspaces.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    canViewAllItems: boolean("can_view_all_items").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.agencyId, table.workspaceId, table.userId] }),
    index("workspace_memberships_user_idx").on(table.agencyId, table.userId),
  ],
);

export const portalAccessTokens = pgTable(
  "portal_access_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id),
    workspaceId: uuid("workspace_id").notNull().references(() => clientWorkspaces.id),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    label: varchar("label", { length: 120 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("portal_access_tokens_hash_uq").on(table.tokenHash),
    index("portal_access_tokens_workspace_idx").on(table.agencyId, table.workspaceId),
  ],
);

export const divisions = pgTable(
  "divisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("divisions_agency_slug_uq").on(table.agencyId, table.slug)],
);

export const workItems = pgTable(
  "work_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id),
    workspaceId: uuid("workspace_id").notNull().references(() => clientWorkspaces.id),
    divisionId: uuid("division_id").references(() => divisions.id),
    ownerUserId: uuid("owner_user_id").references(() => users.id),
    title: varchar("title", { length: 220 }).notNull(),
    description: text("description"),
    status: workItemStatus("status").notNull().default("DRAFT"),
    currentVersionId: uuid("current_version_id"),
    firstPublishedAt: timestamp("first_published_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("work_items_agency_id_uq").on(table.agencyId, table.id),
    index("work_items_workspace_status_idx").on(table.agencyId, table.workspaceId, table.status),
    index("work_items_owner_idx").on(table.agencyId, table.ownerUserId),
  ],
);

export const workItemVersions = pgTable(
  "work_item_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id),
    workItemId: uuid("work_item_id").notNull().references(() => workItems.id),
    versionNumber: integer("version_number").notNull(),
    status: versionStatus("status").notNull().default("DRAFT"),
    note: text("note"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("work_item_versions_number_uq").on(table.agencyId, table.workItemId, table.versionNumber),
    uniqueIndex("work_item_versions_agency_id_uq").on(table.agencyId, table.id),
    index("work_item_versions_item_status_idx").on(table.agencyId, table.workItemId, table.status),
  ],
);

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id),
    workspaceId: uuid("workspace_id").notNull().references(() => clientWorkspaces.id),
    storageKey: varchar("storage_key", { length: 700 }).notNull(),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    declaredMimeType: varchar("declared_mime_type", { length: 150 }),
    detectedMimeType: varchar("detected_mime_type", { length: 150 }),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    checksumSha256: varchar("checksum_sha256", { length: 64 }),
    status: assetStatus("status").notNull().default("PENDING_UPLOAD"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("assets_storage_key_uq").on(table.storageKey),
    uniqueIndex("assets_agency_id_uq").on(table.agencyId, table.id),
    index("assets_workspace_status_idx").on(table.agencyId, table.workspaceId, table.status),
  ],
);

export const versionAssets = pgTable(
  "version_assets",
  {
    agencyId: uuid("agency_id").notNull().references(() => agencies.id),
    versionId: uuid("version_id").notNull().references(() => workItemVersions.id),
    assetId: uuid("asset_id").notNull().references(() => assets.id),
    purpose: varchar("purpose", { length: 40 }).notNull().default("PREVIEW"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.agencyId, table.versionId, table.assetId] })],
);

export const reviewDecisions = pgTable(
  "review_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id),
    workspaceId: uuid("workspace_id").notNull().references(() => clientWorkspaces.id),
    workItemId: uuid("work_item_id").notNull().references(() => workItems.id),
    versionId: uuid("version_id").notNull().references(() => workItemVersions.id),
    decision: reviewDecision("decision").notNull(),
    reviewerLabel: varchar("reviewer_label", { length: 160 }).notNull(),
    portalSessionId: uuid("portal_session_id"),
    idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("review_decisions_idempotency_uq").on(table.agencyId, table.idempotencyKey),
    index("review_decisions_version_idx").on(table.agencyId, table.versionId, table.decidedAt),
  ],
);

export const feedbackEntries = pgTable(
  "feedback_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id),
    workspaceId: uuid("workspace_id").notNull().references(() => clientWorkspaces.id),
    reviewDecisionId: uuid("review_decision_id").notNull().references(() => reviewDecisions.id),
    kind: feedbackKind("kind").notNull(),
    visibility: visibility("visibility").notNull().default("CLIENT_VISIBLE"),
    textContent: text("text_content"),
    referenceUrl: text("reference_url"),
    assetId: uuid("asset_id").references(() => assets.id),
    originalLanguage: varchar("original_language", { length: 24 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("feedback_entries_review_idx").on(table.agencyId, table.reviewDecisionId)],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id),
    workspaceId: uuid("workspace_id"),
    actorType: varchar("actor_type", { length: 40 }).notNull(),
    actorId: varchar("actor_id", { length: 160 }),
    action: varchar("action", { length: 120 }).notNull(),
    resourceType: varchar("resource_type", { length: 80 }).notNull(),
    resourceId: uuid("resource_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    requestId: varchar("request_id", { length: 100 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_events_workspace_time_idx").on(table.agencyId, table.workspaceId, table.occurredAt),
    index("audit_events_resource_idx").on(table.agencyId, table.resourceType, table.resourceId),
  ],
);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id),
    eventType: varchar("event_type", { length: 120 }).notNull(),
    aggregateType: varchar("aggregate_type", { length: 80 }).notNull(),
    aggregateId: uuid("aggregate_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: outboxStatus("status").notNull().default("PENDING"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("outbox_events_dispatch_idx").on(table.status, table.availableAt)],
);

export type Agency = typeof agencies.$inferSelect;
export type ClientWorkspace = typeof clientWorkspaces.$inferSelect;
export type WorkItem = typeof workItems.$inferSelect;
export type WorkItemVersion = typeof workItemVersions.$inferSelect;
