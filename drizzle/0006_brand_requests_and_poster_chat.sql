ALTER TABLE work_items
  ADD COLUMN request_asset_id VARCHAR(36) NULL,
  ADD CONSTRAINT work_items_request_asset_fk FOREIGN KEY (request_asset_id) REFERENCES assets(id);

ALTER TABLE chat_threads
  DROP INDEX chat_threads_scope_uq,
  ADD COLUMN work_item_id VARCHAR(36) NULL,
  ADD CONSTRAINT chat_threads_work_item_fk FOREIGN KEY (work_item_id) REFERENCES work_items(id),
  ADD UNIQUE INDEX chat_threads_scope_uq (agency_id, workspace_id, kind, owner_key),
  ADD INDEX chat_threads_work_item_idx (agency_id, work_item_id);
