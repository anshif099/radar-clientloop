-- Existing work remains uncategorized until a category is chosen on a new version.
ALTER TABLE work_items
  ADD COLUMN category VARCHAR(80) NULL,
  ADD COLUMN subcategory VARCHAR(100) NULL;
