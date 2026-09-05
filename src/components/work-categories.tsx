"use client";

import { useState } from "react";
import { getWorkCategory, workCategories, type CategorizedWork, type CategoryFilter } from "@/domain/work-categories";

export function UploadCategoryFields({ initialValue, disabled }: { initialValue?: CategorizedWork; disabled: boolean }) {
  const [category, setCategory] = useState(initialValue?.category ?? "");
  const [subcategory, setSubcategory] = useState(initialValue?.subcategory ?? "");
  const selected = getWorkCategory(category);
  return (
    <fieldset className="upload-content-fields upload-category-fields" disabled={disabled}>
      <label>Category
        <select name="category" value={category} required onChange={(event) => { setCategory(event.target.value); setSubcategory(""); }}>
          <option value="">Select category</option>
          {workCategories.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
        </select>
      </label>
      <label>Subcategory
        <select name="subcategory" value={subcategory} required disabled={!selected} onChange={(event) => setSubcategory(event.target.value)}>
          <option value="">Select subcategory</option>
          {selected?.subcategories.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
        </select>
      </label>
    </fieldset>
  );
}

export function CategoryFilters({ value, onChange }: { value: CategoryFilter; onChange: (value: CategoryFilter) => void }) {
  const selected = getWorkCategory(value.category);
  return (
    <div className="category-filters" role="group" aria-label="Filter by category and subcategory">
      <label>Category
        <select value={value.category} onChange={(event) => onChange({ category: event.target.value, subcategory: "all" })}>
          <option value="all">All categories</option>
          {workCategories.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
          <option value="uncategorized">Uncategorized</option>
        </select>
      </label>
      <label>Subcategory
        <select value={value.subcategory} disabled={!selected} onChange={(event) => onChange({ ...value, subcategory: event.target.value })}>
          <option value="all">All subcategories</option>
          {selected?.subcategories.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
        </select>
      </label>
    </div>
  );
}
