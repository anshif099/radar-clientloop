-- Histories have no cascading delete: closing a company keeps its conversations.
CREATE TABLE chat_threads (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  agency_id VARCHAR(36) NOT NULL,
  workspace_id VARCHAR(36) NOT NULL,
  kind ENUM('COMPANY', 'AI') NOT NULL,
  owner_key VARCHAR(36) NOT NULL DEFAULT '',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT chat_threads_workspace_fk FOREIGN KEY (agency_id, workspace_id) REFERENCES client_workspaces(agency_id, id),
  CONSTRAINT chat_threads_scope_uq UNIQUE (agency_id, workspace_id, kind, owner_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE chat_messages (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  thread_id VARCHAR(36) NOT NULL,
  sender_id VARCHAR(36) NOT NULL,
  sender_name VARCHAR(160) NOT NULL,
  sender_role ENUM('ADMIN', 'COMPANY', 'ASSISTANT') NOT NULL,
  client_message_id VARCHAR(36) NOT NULL,
  body TEXT NOT NULL,
  metadata JSON NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT chat_messages_thread_fk FOREIGN KEY (thread_id) REFERENCES chat_threads(id),
  CONSTRAINT chat_messages_retry_uq UNIQUE (thread_id, sender_id, client_message_id),
  INDEX chat_messages_history_idx (thread_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE chat_attachments (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  message_id INT UNSIGNED NOT NULL,
  storage_key VARCHAR(700) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(150) NOT NULL,
  size_bytes INT UNSIGNED NOT NULL,
  checksum_sha256 VARCHAR(64) NOT NULL,
  CONSTRAINT chat_attachments_message_fk FOREIGN KEY (message_id) REFERENCES chat_messages(id),
  CONSTRAINT chat_attachments_storage_uq UNIQUE (storage_key),
  INDEX chat_attachments_message_idx (message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
