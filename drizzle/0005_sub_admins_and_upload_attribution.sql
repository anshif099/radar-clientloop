ALTER TABLE auth_users
  MODIFY COLUMN role ENUM('admin', 'subadmin', 'user') NOT NULL DEFAULT 'user';

CREATE TABLE sub_admin_profiles (
  auth_user_id VARCHAR(36) NOT NULL,
  position VARCHAR(80) NOT NULL,
  created_by_user_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (auth_user_id),
  CONSTRAINT sub_admin_profiles_user_fk FOREIGN KEY (auth_user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  CONSTRAINT sub_admin_profiles_creator_fk FOREIGN KEY (created_by_user_id) REFERENCES auth_users(id),
  INDEX sub_admin_profiles_creator_idx (created_by_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE work_item_versions
  ADD COLUMN uploaded_by_name VARCHAR(160) NOT NULL DEFAULT 'ClientLoop Super Admin',
  ADD COLUMN uploaded_by_position VARCHAR(80) NULL;
