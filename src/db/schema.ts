import { randomUUID } from "node:crypto";
import {
  bigint,
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const timestamps = {
  createdAt: timestamp("created_at", { mode: "date", fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
    .notNull()
    .defaultNow()
    .onUpdateNow(),
};

const uuid = (name: string) => varchar(name, { length: 36 });
const primaryUuid = (name = "id") => uuid(name).primaryKey().$defaultFn(randomUUID);

const agencyStatuses = ["ACTIVE", "SUSPENDED", "CLOSED"] as const;
const membershipStatuses = ["INVITED", "ACTIVE", "DISABLED"] as const;
const roleKeys = ["ADMIN", "PROJECT_MANAGER", "CONTRIBUTOR", "SOCIAL"] as const;
const workspaceStatuses = ["ACTIVE", "ARCHIVED"] as const;
const workItemStatuses = [
  "DRAFT",
  "AWAITING_CLIENT_REVIEW",
  "REVISION_REQUIRED",
  "APPROVED",
  "ARCHIVED",
] as const;
const versionStatuses = ["DRAFT", "PROCESSING", "READY", "PUBLISHED"] as const;
const assetStatuses = [
  "PENDING_UPLOAD",
  "QUARANTINED",
  "PROCESSING",
  "READY",
  "REJECTED",
  "DELETED",
] as const;
const reviewDecisionsList = ["APPROVE", "REQUEST_CHANGES", "REJECT"] as const;
const feedbackKinds = ["TEXT", "VOICE", "REFERENCE_FILE", "REFERENCE_URL"] as const;
const visibilityValues = ["CLIENT_VISIBLE", "INTERNAL_ONLY"] as const;
const outboxStatuses = ["PENDING", "PROCESSING", "DELIVERED", "FAILED"] as const;

export const agencies = mysqlTable(
  "agencies",
  {
    id: primaryUuid(),
    name: varchar("name", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    status: mysqlEnum("status", agencyStatuses).notNull().default("ACTIVE"),
    timezone: varchar("timezone", { length: 64 }).notNull().default("Asia/Kolkata"),
    locale: varchar("locale", { length: 16 }).notNull().default("en-IN"),
    brand: json("brand").$type<Record<string, unknown>>().notNull().$defaultFn(() => ({})),
    ...timestamps,
  },
  (table) => [uniqueIndex("agencies_slug_uq").on(table.slug)],
);

export const users = mysqlTable(
  "users",
  {
    id: primaryUuid(),
    identityProviderId: varchar("identity_provider_id", { length: 36 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    displayName: varchar("display_name", { length: 160 }).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_identity_provider_id_uq").on(table.identityProviderId)],
);

export const agencyMemberships = mysqlTable(
  "agency_memberships",
  {
    agencyId: uuid("agency_id").notNull().references(() => agencies.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    role: mysqlEnum("role", roleKeys).notNull(),
    status: mysqlEnum("status", membershipStatuses).notNull().default("INVITED"),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.agencyId, table.userId] }),
    index("agency_memberships_user_idx").on(table.userId),
  ],
);

export const clientWorkspaces = mysqlTable(
  "client_workspaces",
  {
    id: primaryUuid(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id),
    name: varchar("name", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 110 }).notNull(),
    status: mysqlEnum("status", workspaceStatuses).notNull().default("ACTIVE"),
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

export const workspaceMemberships = mysqlTable(
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

export const portalAccessTokens = mysqlTable(
  "portal_access_tokens",
  {
    id: primaryUuid(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id),
    workspaceId: uuid("workspace_id").notNull().references(() => clientWorkspaces.id),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    label: varchar("label", { length: 120 }),
    expiresAt: timestamp("expires_at", { mode: "date", fsp: 3 }),
    lastUsedAt: timestamp("last_used_at", { mode: "date", fsp: 3 }),
    revokedAt: timestamp("revoked_at", { mode: "date", fsp: 3 }),
    createdAt: timestamp("created_at", { mode: "date", fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("portal_access_tokens_hash_uq").on(table.tokenHash),
    index("portal_access_tokens_workspace_idx").on(table.agencyId, table.workspaceId),
  ],
);

export const divisions = mysqlTable(
  "divisions",
  {
    id: primaryUuid(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("divisions_agency_slug_uq").on(table.agencyId, table.slug)],
);

export const workItems = mysqlTable(
  "work_items",
  {
    id: primaryUuid(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id),
    workspaceId: uuid("workspace_id").notNull().references(() => clientWorkspaces.id),
    divisionId: uuid("division_id").references(() => divisions.id),
    ownerUserId: uuid("owner_user_id").references(() => users.id),
    title: varchar("title", { length: 220 }).notNull(),
    category: varchar("category", { length: 80 }),
    subcategory: varchar("subcategory", { length: 100 }),
    description: text("description"),
    status: mysqlEnum("status", workItemStatuses).notNull().default("DRAFT"),
    currentVersionId: uuid("current_version_id"),
    firstPublishedAt: timestamp("first_published_at", { mode: "date", fsp: 3 }),
    approvedAt: timestamp("approved_at", { mode: "date", fsp: 3 }),
    archivedAt: timestamp("archived_at", { mode: "date", fsp: 3 }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("work_items_agency_id_uq").on(table.agencyId, table.id),
    index("work_items_workspace_status_idx").on(table.agencyId, table.workspaceId, table.status),
    index("work_items_owner_idx").on(table.agencyId, table.ownerUserId),
  ],
);

export const workItemVersions = mysqlTable(
  "work_item_versions",
  {
    id: primaryUuid(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id),
    workItemId: uuid("work_item_id").notNull().references(() => workItems.id),
    versionNumber: int("version_number").notNull(),
    status: mysqlEnum("status", versionStatuses).notNull().default("DRAFT"),
    note: text("note"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    publishedAt: timestamp("published_at", { mode: "date", fsp: 3 }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("work_item_versions_number_uq").on(table.agencyId, table.workItemId, table.versionNumber),
    uniqueIndex("work_item_versions_agency_id_uq").on(table.agencyId, table.id),
    index("work_item_versions_item_status_idx").on(table.agencyId, table.workItemId, table.status),
  ],
);

export const assets = mysqlTable(
  "assets",
  {
    id: primaryUuid(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id),
    workspaceId: uuid("workspace_id").notNull().references(() => clientWorkspaces.id),
    storageKey: varchar("storage_key", { length: 700 }).notNull(),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    declaredMimeType: varchar("declared_mime_type", { length: 150 }),
    detectedMimeType: varchar("detected_mime_type", { length: 150 }),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    checksumSha256: varchar("checksum_sha256", { length: 64 }),
    status: mysqlEnum("status", assetStatuses).notNull().default("PENDING_UPLOAD"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("assets_storage_key_uq").on(table.storageKey),
    uniqueIndex("assets_agency_id_uq").on(table.agencyId, table.id),
    index("assets_workspace_status_idx").on(table.agencyId, table.workspaceId, table.status),
  ],
);

export const versionAssets = mysqlTable(
  "version_assets",
  {
    agencyId: uuid("agency_id").notNull().references(() => agencies.id),
    versionId: uuid("version_id").notNull().references(() => workItemVersions.id),
    assetId: uuid("asset_id").notNull().references(() => assets.id),
    purpose: varchar("purpose", { length: 40 }).notNull().default("PREVIEW"),
    position: int("position").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date", fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.agencyId, table.versionId, table.assetId] })],
);

export const reviewDecisions = mysqlTable(
  "review_decisions",
  {
    id: primaryUuid(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id),
    workspaceId: uuid("workspace_id").notNull().references(() => clientWorkspaces.id),
    workItemId: uuid("work_item_id").notNull().references(() => workItems.id),
    versionId: uuid("version_id").notNull().references(() => workItemVersions.id),
    decision: mysqlEnum("decision", reviewDecisionsList).notNull(),
    reviewerLabel: varchar("reviewer_label", { length: 160 }).notNull(),
    portalSessionId: uuid("portal_session_id"),
    idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
    decidedAt: timestamp("decided_at", { mode: "date", fsp: 3 }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { mode: "date", fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("review_decisions_idempotency_uq").on(table.agencyId, table.idempotencyKey),
    index("review_decisions_version_idx").on(table.agencyId, table.versionId, table.decidedAt),
  ],
);

export const feedbackEntries = mysqlTable(
  "feedback_entries",
  {
    id: primaryUuid(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id),
    workspaceId: uuid("workspace_id").notNull().references(() => clientWorkspaces.id),
    reviewDecisionId: uuid("review_decision_id").notNull().references(() => reviewDecisions.id),
    kind: mysqlEnum("kind", feedbackKinds).notNull(),
    visibility: mysqlEnum("visibility", visibilityValues).notNull().default("CLIENT_VISIBLE"),
    textContent: text("text_content"),
    referenceUrl: text("reference_url"),
    assetId: uuid("asset_id").references(() => assets.id),
    originalLanguage: varchar("original_language", { length: 24 }),
    createdAt: timestamp("created_at", { mode: "date", fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [index("feedback_entries_review_idx").on(table.agencyId, table.reviewDecisionId)],
);

export const auditEvents = mysqlTable(
  "audit_events",
  {
    id: primaryUuid(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id),
    workspaceId: uuid("workspace_id"),
    actorType: varchar("actor_type", { length: 40 }).notNull(),
    actorId: varchar("actor_id", { length: 160 }),
    action: varchar("action", { length: 120 }).notNull(),
    resourceType: varchar("resource_type", { length: 80 }).notNull(),
    resourceId: uuid("resource_id"),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull().$defaultFn(() => ({})),
    requestId: varchar("request_id", { length: 100 }),
    occurredAt: timestamp("occurred_at", { mode: "date", fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_events_workspace_time_idx").on(table.agencyId, table.workspaceId, table.occurredAt),
    index("audit_events_resource_idx").on(table.agencyId, table.resourceType, table.resourceId),
  ],
);

export const outboxEvents = mysqlTable(
  "outbox_events",
  {
    id: primaryUuid(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id),
    eventType: varchar("event_type", { length: 120 }).notNull(),
    aggregateType: varchar("aggregate_type", { length: 80 }).notNull(),
    aggregateId: uuid("aggregate_id").notNull(),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    status: mysqlEnum("status", outboxStatuses).notNull().default("PENDING"),
    attempts: int("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { mode: "date", fsp: 3 }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { mode: "date", fsp: 3 }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { mode: "date", fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [index("outbox_events_dispatch_idx").on(table.status, table.availableAt)],
);

export type Agency = typeof agencies.$inferSelect;
export type ClientWorkspace = typeof clientWorkspaces.$inferSelect;
export type WorkItem = typeof workItems.$inferSelect;
export type WorkItemVersion = typeof workItemVersions.$inferSelect;

// A shared company room, plus a separate assistant history for each signed-in user.
export const chatThreads = mysqlTable("chat_threads", {
  id: primaryUuid(),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id),
  workspaceId: uuid("workspace_id").notNull().references(() => clientWorkspaces.id),
  kind: mysqlEnum("kind", ["COMPANY", "AI"]).notNull(),
  ownerKey: varchar("owner_key", { length: 36 }).notNull().default(""),
  ...timestamps,
}, (table) => [uniqueIndex("chat_threads_scope_uq").on(table.agencyId, table.workspaceId, table.kind, table.ownerKey)]);

export const chatMessages = mysqlTable("chat_messages", {
  id: int("id", { unsigned: true }).autoincrement().primaryKey(),
  threadId: uuid("thread_id").notNull().references(() => chatThreads.id),
  senderId: varchar("sender_id", { length: 36 }).notNull(),
  senderName: varchar("sender_name", { length: 160 }).notNull(),
  senderRole: mysqlEnum("sender_role", ["ADMIN", "COMPANY", "ASSISTANT"]).notNull(),
  clientMessageId: uuid("client_message_id").notNull(),
  body: text("body").notNull(),
  metadata: json("metadata").$type<Record<string, unknown>>().notNull().$defaultFn(() => ({})),
  createdAt: timestamp("created_at", { mode: "date", fsp: 3 }).notNull().defaultNow(),
}, (table) => [
  index("chat_messages_history_idx").on(table.threadId, table.id),
  uniqueIndex("chat_messages_retry_uq").on(table.threadId, table.senderId, table.clientMessageId),
]);

export const chatAttachments = mysqlTable("chat_attachments", {
  id: primaryUuid(),
  messageId: int("message_id", { unsigned: true }).notNull().references(() => chatMessages.id),
  storageKey: varchar("storage_key", { length: 700 }).notNull(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 150 }).notNull(),
  sizeBytes: int("size_bytes", { unsigned: true }).notNull(),
  checksumSha256: varchar("checksum_sha256", { length: 64 }).notNull(),
}, (table) => [index("chat_attachments_message_idx").on(table.messageId), uniqueIndex("chat_attachments_storage_uq").on(table.storageKey)]);
