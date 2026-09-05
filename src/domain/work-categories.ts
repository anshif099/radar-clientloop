export const workCategories = [
  {
    id: "graphic-design", label: "Graphic Design",
    subcategories: [
      { id: "logo-branding", label: "Logo Branding" },
      { id: "package-designs", label: "Package Designs" },
      { id: "social-media-creatives", label: "Social Media Creatives" },
      { id: "digital-ad-banners", label: "Digital Ad Banners" },
      { id: "ooh-designs", label: "OOH Designs" },
      { id: "leaflets", label: "Leaflets" },
      { id: "brochures", label: "Brochures" },
      { id: "magazines", label: "Magazines" },
    ],
  },
  {
    id: "ui-ux", label: "UI/UX",
    subcategories: [
      { id: "ui-ux-wireframes", label: "UI/UX Wireframes" },
      { id: "web-app-prototypes", label: "Web/App Prototypes" },
      { id: "web-app-mockups", label: "Web/App Mockups" },
    ],
  },
  {
    id: "video", label: "Video",
    subcategories: [
      { id: "video-storyboards", label: "Video Storyboards" },
      { id: "visual-scripts", label: "Visual Scripts" },
      { id: "video-mockups", label: "Video Mockups" },
    ],
  },
  {
    id: "content-design", label: "Content Design",
    subcategories: [
      { id: "copy-articles", label: "Copy Articles" },
      { id: "blog-copy", label: "Blog Copy" },
    ],
  },
] as const;

export type WorkCategoryId = typeof workCategories[number]["id"];
export interface WorkClassification { category: WorkCategoryId; subcategory: string }
export interface CategorizedWork { category: string | null; subcategory: string | null }
export interface CategoryFilter { category: string; subcategory: string }
export const allCategories: CategoryFilter = { category: "all", subcategory: "all" };

export function getWorkCategory(category: string | null | undefined) {
  return workCategories.find((option) => option.id === category);
}

export function parseWorkClassification(category: string, subcategory: string): WorkClassification | null {
  const selected = getWorkCategory(category);
  if (!selected?.subcategories.some((option) => option.id === subcategory)) return null;
  return { category: selected.id, subcategory };
}

export function workClassificationLabel(item: CategorizedWork) {
  const category = getWorkCategory(item.category);
  if (!category) return "Uncategorized";
  const subcategory = category.subcategories.find((option) => option.id === item.subcategory);
  return subcategory ? `${category.label} · ${subcategory.label}` : category.label;
}

export function matchesCategoryFilter(item: CategorizedWork, filter: CategoryFilter) {
  if (filter.category === "uncategorized") return !getWorkCategory(item.category);
  if (filter.category !== "all" && item.category !== filter.category) return false;
  return filter.subcategory === "all" || item.subcategory === filter.subcategory;
}
