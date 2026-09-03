CREATE TABLE auth_users (
  id VARCHAR(36) NOT NULL,
  name TEXT NOT NULL,
  email VARCHAR(255) NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  image TEXT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  banned BOOLEAN NOT NULL DEFAULT FALSE,
  ban_reason TEXT NULL,
  ban_expires TIMESTAMP(3) NULL,
  PRIMARY KEY (id),
  CONSTRAINT auth_users_email_uq UNIQUE (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE auth_sessions (
  id VARCHAR(36) NOT NULL,
  expires_at TIMESTAMP(3) NOT NULL,
  token VARCHAR(255) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  ip_address TEXT NULL,
  user_agent TEXT NULL,
  user_id VARCHAR(36) NOT NULL,
  impersonated_by VARCHAR(36) NULL,
  PRIMARY KEY (id),
  CONSTRAINT auth_sessions_token_uq UNIQUE (token),
  CONSTRAINT auth_sessions_user_fk FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  INDEX auth_sessions_user_idx (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE auth_accounts (
  id VARCHAR(36) NOT NULL,
  issuer VARCHAR(255) NOT NULL,
  account_id VARCHAR(255) NOT NULL,
  provider_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  access_token TEXT NULL,
  refresh_token TEXT NULL,
  id_token TEXT NULL,
  access_token_expires_at TIMESTAMP(3) NULL,
  refresh_token_expires_at TIMESTAMP(3) NULL,
  scope TEXT NULL,
  password TEXT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT auth_accounts_issuer_account_uq UNIQUE (issuer, account_id),
  CONSTRAINT auth_accounts_user_fk FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  INDEX auth_accounts_user_idx (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE auth_verifications (
  id VARCHAR(36) NOT NULL,
  identifier VARCHAR(255) NOT NULL,
  value TEXT NOT NULL,
  expires_at TIMESTAMP(3) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX auth_verifications_identifier_idx (identifier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
