CREATE TABLE agencies (
  id VARCHAR(36) NOT NULL,
  name VARCHAR(180) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  status ENUM('ACTIVE', 'SUSPENDED', 'CLOSED') NOT NULL DEFAULT 'ACTIVE',
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
  locale VARCHAR(16) NOT NULL DEFAULT 'en-IN',
  brand JSON NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT agencies_slug_uq UNIQUE (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id VARCHAR(36) NOT NULL,
  identity_provider_id VARCHAR(36) NOT NULL,
  email VARCHAR(320) NOT NULL,
  display_name VARCHAR(160) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT users_identity_provider_id_uq UNIQUE (identity_provider_id),
  CONSTRAINT users_auth_identity_fk FOREIGN KEY (identity_provider_id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE agency_memberships (
  agency_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  role ENUM('ADMIN', 'PROJECT_MANAGER', 'CONTRIBUTOR', 'SOCIAL') NOT NULL,
  status ENUM('INVITED', 'ACTIVE', 'DISABLED') NOT NULL DEFAULT 'INVITED',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (agency_id, user_id),
  CONSTRAINT agency_memberships_agency_fk FOREIGN KEY (agency_id) REFERENCES agencies(id),
  CONSTRAINT agency_memberships_user_fk FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX agency_memberships_user_idx (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE client_workspaces (
  id VARCHAR(36) NOT NULL,
  agency_id VARCHAR(36) NOT NULL,
  name VARCHAR(180) NOT NULL,
  slug VARCHAR(110) NOT NULL,
  status ENUM('ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  showcase_consent BOOLEAN NOT NULL DEFAULT FALSE,
  require_otp BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT client_workspaces_agency_slug_uq UNIQUE (agency_id, slug),
  CONSTRAINT client_workspaces_agency_id_uq UNIQUE (agency_id, id),
  CONSTRAINT client_workspaces_agency_fk FOREIGN KEY (agency_id) REFERENCES agencies(id),
  INDEX client_workspaces_agency_status_idx (agency_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE workspace_memberships (
  agency_id VARCHAR(36) NOT NULL,
  workspace_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  can_view_all_items BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (agency_id, workspace_id, user_id),
  CONSTRAINT workspace_memberships_workspace_fk FOREIGN KEY (agency_id, workspace_id)
    REFERENCES client_workspaces(agency_id, id),
  CONSTRAINT workspace_memberships_membership_fk FOREIGN KEY (agency_id, user_id)
    REFERENCES agency_memberships(agency_id, user_id),
  INDEX workspace_memberships_user_idx (agency_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE portal_access_tokens (
  id VARCHAR(36) NOT NULL,
  agency_id VARCHAR(36) NOT NULL,
  workspace_id VARCHAR(36) NOT NULL,
  token_hash VARCHAR(128) NOT NULL,
  label VARCHAR(120) NULL,
  expires_at TIMESTAMP(3) NULL,
  last_used_at TIMESTAMP(3) NULL,
  revoked_at TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT portal_access_tokens_hash_uq UNIQUE (token_hash),
  CONSTRAINT portal_access_tokens_workspace_fk FOREIGN KEY (agency_id, workspace_id)
    REFERENCES client_workspaces(agency_id, id),
  INDEX portal_access_tokens_workspace_idx (agency_id, workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE divisions (
  id VARCHAR(36) NOT NULL,
  agency_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT divisions_agency_slug_uq UNIQUE (agency_id, slug),
  CONSTRAINT divisions_agency_id_uq UNIQUE (agency_id, id),
  CONSTRAINT divisions_agency_fk FOREIGN KEY (agency_id) REFERENCES agencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE work_items (
  id VARCHAR(36) NOT NULL,
  agency_id VARCHAR(36) NOT NULL,
  workspace_id VARCHAR(36) NOT NULL,
  division_id VARCHAR(36) NULL,
  owner_user_id VARCHAR(36) NULL,
  title VARCHAR(220) NOT NULL,
  description TEXT NULL,
  status ENUM('DRAFT', 'AWAITING_CLIENT_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  current_version_id VARCHAR(36) NULL,
  first_published_at TIMESTAMP(3) NULL,
  approved_at TIMESTAMP(3) NULL,
  archived_at TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT work_items_agency_id_uq UNIQUE (agency_id, id),
  CONSTRAINT work_items_workspace_fk FOREIGN KEY (agency_id, workspace_id)
    REFERENCES client_workspaces(agency_id, id),
  CONSTRAINT work_items_division_fk FOREIGN KEY (agency_id, division_id)
    REFERENCES divisions(agency_id, id),
  CONSTRAINT work_items_owner_fk FOREIGN KEY (agency_id, owner_user_id)
    REFERENCES agency_memberships(agency_id, user_id),
  INDEX work_items_workspace_status_idx (agency_id, workspace_id, status),
  INDEX work_items_owner_idx (agency_id, owner_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE work_item_versions (
  id VARCHAR(36) NOT NULL,
  agency_id VARCHAR(36) NOT NULL,
  work_item_id VARCHAR(36) NOT NULL,
  version_number INT NOT NULL,
  status ENUM('DRAFT', 'PROCESSING', 'READY', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
  note TEXT NULL,
  created_by_user_id VARCHAR(36) NULL,
  published_at TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT work_item_versions_number_uq UNIQUE (agency_id, work_item_id, version_number),
  CONSTRAINT work_item_versions_agency_id_uq UNIQUE (agency_id, id),
  CONSTRAINT work_item_versions_item_fk FOREIGN KEY (agency_id, work_item_id)
    REFERENCES work_items(agency_id, id),
  CONSTRAINT work_item_versions_creator_fk FOREIGN KEY (agency_id, created_by_user_id)
    REFERENCES agency_memberships(agency_id, user_id),
  CONSTRAINT work_item_versions_number_ck CHECK (version_number > 0),
  INDEX work_item_versions_item_status_idx (agency_id, work_item_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE work_items
  ADD CONSTRAINT work_items_current_version_fk
  FOREIGN KEY (agency_id, current_version_id)
  REFERENCES work_item_versions(agency_id, id);

CREATE TABLE assets (
  id VARCHAR(36) NOT NULL,
  agency_id VARCHAR(36) NOT NULL,
  workspace_id VARCHAR(36) NOT NULL,
  storage_key VARCHAR(700) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  declared_mime_type VARCHAR(150) NULL,
  detected_mime_type VARCHAR(150) NULL,
  size_bytes BIGINT NULL,
  checksum_sha256 VARCHAR(64) NULL,
  status ENUM('PENDING_UPLOAD', 'QUARANTINED', 'PROCESSING', 'READY', 'REJECTED', 'DELETED') NOT NULL DEFAULT 'PENDING_UPLOAD',
  created_by_user_id VARCHAR(36) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT assets_storage_key_uq UNIQUE (storage_key),
  CONSTRAINT assets_agency_id_uq UNIQUE (agency_id, id),
  CONSTRAINT assets_workspace_fk FOREIGN KEY (agency_id, workspace_id)
    REFERENCES client_workspaces(agency_id, id),
  CONSTRAINT assets_creator_fk FOREIGN KEY (agency_id, created_by_user_id)
    REFERENCES agency_memberships(agency_id, user_id),
  CONSTRAINT assets_size_ck CHECK (size_bytes IS NULL OR size_bytes >= 0),
  INDEX assets_workspace_status_idx (agency_id, workspace_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE version_assets (
  agency_id VARCHAR(36) NOT NULL,
  version_id VARCHAR(36) NOT NULL,
  asset_id VARCHAR(36) NOT NULL,
  purpose VARCHAR(40) NOT NULL DEFAULT 'PREVIEW',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (agency_id, version_id, asset_id),
  CONSTRAINT version_assets_version_fk FOREIGN KEY (agency_id, version_id)
    REFERENCES work_item_versions(agency_id, id),
  CONSTRAINT version_assets_asset_fk FOREIGN KEY (agency_id, asset_id)
    REFERENCES assets(agency_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE review_decisions (
  id VARCHAR(36) NOT NULL,
  agency_id VARCHAR(36) NOT NULL,
  workspace_id VARCHAR(36) NOT NULL,
  work_item_id VARCHAR(36) NOT NULL,
  version_id VARCHAR(36) NOT NULL,
  decision ENUM('APPROVE', 'REQUEST_CHANGES', 'REJECT') NOT NULL,
  reviewer_label VARCHAR(160) NOT NULL,
  portal_session_id VARCHAR(36) NULL,
  idempotency_key VARCHAR(160) NOT NULL,
  decided_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT review_decisions_idempotency_uq UNIQUE (agency_id, idempotency_key),
  CONSTRAINT review_decisions_agency_id_uq UNIQUE (agency_id, id),
  CONSTRAINT review_decisions_workspace_fk FOREIGN KEY (agency_id, workspace_id)
    REFERENCES client_workspaces(agency_id, id),
  CONSTRAINT review_decisions_item_fk FOREIGN KEY (agency_id, work_item_id)
    REFERENCES work_items(agency_id, id),
  CONSTRAINT review_decisions_version_fk FOREIGN KEY (agency_id, version_id)
    REFERENCES work_item_versions(agency_id, id),
  INDEX review_decisions_version_idx (agency_id, version_id, decided_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE feedback_entries (
  id VARCHAR(36) NOT NULL,
  agency_id VARCHAR(36) NOT NULL,
  workspace_id VARCHAR(36) NOT NULL,
  review_decision_id VARCHAR(36) NOT NULL,
  kind ENUM('TEXT', 'VOICE', 'REFERENCE_FILE', 'REFERENCE_URL') NOT NULL,
  visibility ENUM('CLIENT_VISIBLE', 'INTERNAL_ONLY') NOT NULL DEFAULT 'CLIENT_VISIBLE',
  text_content TEXT NULL,
  reference_url TEXT NULL,
  asset_id VARCHAR(36) NULL,
  original_language VARCHAR(24) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT feedback_entries_workspace_fk FOREIGN KEY (agency_id, workspace_id)
    REFERENCES client_workspaces(agency_id, id),
  CONSTRAINT feedback_entries_review_fk FOREIGN KEY (agency_id, review_decision_id)
    REFERENCES review_decisions(agency_id, id),
  CONSTRAINT feedback_entries_asset_fk FOREIGN KEY (agency_id, asset_id)
    REFERENCES assets(agency_id, id),
  CONSTRAINT feedback_entries_payload_ck CHECK (
    (kind = 'TEXT' AND text_content IS NOT NULL) OR
    (kind = 'VOICE' AND asset_id IS NOT NULL) OR
    (kind = 'REFERENCE_FILE' AND asset_id IS NOT NULL) OR
    (kind = 'REFERENCE_URL' AND reference_url IS NOT NULL)
  ),
  INDEX feedback_entries_review_idx (agency_id, review_decision_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_events (
  id VARCHAR(36) NOT NULL,
  agency_id VARCHAR(36) NOT NULL,
  workspace_id VARCHAR(36) NULL,
  actor_type VARCHAR(40) NOT NULL,
  actor_id VARCHAR(160) NULL,
  action VARCHAR(120) NOT NULL,
  resource_type VARCHAR(80) NOT NULL,
  resource_id VARCHAR(36) NULL,
  metadata JSON NOT NULL,
  request_id VARCHAR(100) NULL,
  occurred_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT audit_events_agency_fk FOREIGN KEY (agency_id) REFERENCES agencies(id),
  CONSTRAINT audit_events_workspace_fk FOREIGN KEY (agency_id, workspace_id)
    REFERENCES client_workspaces(agency_id, id),
  INDEX audit_events_workspace_time_idx (agency_id, workspace_id, occurred_at),
  INDEX audit_events_resource_idx (agency_id, resource_type, resource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TRIGGER audit_events_immutable_update
BEFORE UPDATE ON audit_events
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit events are append-only';

CREATE TRIGGER audit_events_immutable_delete
BEFORE DELETE ON audit_events
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit events are append-only';

CREATE TABLE outbox_events (
  id VARCHAR(36) NOT NULL,
  agency_id VARCHAR(36) NOT NULL,
  event_type VARCHAR(120) NOT NULL,
  aggregate_type VARCHAR(80) NOT NULL,
  aggregate_id VARCHAR(36) NOT NULL,
  payload JSON NOT NULL,
  status ENUM('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED') NOT NULL DEFAULT 'PENDING',
  attempts INT NOT NULL DEFAULT 0,
  available_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  processed_at TIMESTAMP(3) NULL,
  last_error TEXT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT outbox_events_agency_fk FOREIGN KEY (agency_id) REFERENCES agencies(id),
  CONSTRAINT outbox_events_attempts_ck CHECK (attempts >= 0),
  INDEX outbox_events_dispatch_idx (status, available_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
