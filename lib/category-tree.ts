import type { InventoryCategory } from "@/lib/inventory-types";

/** Parse INVENTORY_CATEGORY_ALLOWLIST; null = no restriction (show all). */
export function parseCategoryAllowlist(): string[] | null {
  const raw = process.env.INVENTORY_CATEGORY_ALLOWLIST?.trim();
  if (!raw) return null;
  const parts = raw
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
  return parts.length > 0 ? parts : null;
}

function normalizeToken(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function aliasSegment(alias: string | undefined): string | undefined {
  if (!alias) return undefined;
  const parts = alias.replace(/^\/+|\/+$/g, "").split("/");
  return parts[parts.length - 1]?.toLowerCase();
}

/** Match by display name, path alias segment, or taxonomy UUID. */
export function categoryMatchesAllowlist(
  cat: InventoryCategory,
  allowlist: string[]
): boolean {
  const nameNorm = normalizeToken(cat.name);
  for (const entry of allowlist) {
    const entryNorm = normalizeToken(entry);
    if (cat.id === entry || cat.id.toLowerCase() === entryNorm) return true;
    if (nameNorm === entryNorm) return true;
    const seg = aliasSegment(cat.pathAlias);
    if (seg && (seg === entryNorm || seg === entryNorm.replace(/\s+/g, "-"))) {
      return true;
    }
  }
  return false;
}

function collectAllowlistKeepIds(
  categories: InventoryCategory[],
  allowlist: string[]
): Set<string> {
  const matched = categories.filter((c) => categoryMatchesAllowlist(c, allowlist));
  if (matched.length === 0) return new Set();

  const keep = new Set<string>();
  for (const cat of matched) {
    for (const id of collectDescendantIds(categories, cat.id)) {
      keep.add(id);
    }
    let parentId = cat.parentId;
    while (parentId) {
      keep.add(parentId);
      parentId = categories.find((c) => c.id === parentId)?.parentId;
    }
  }
  return keep;
}

/** Keep allowlisted terms, their descendants, and ancestors (for hierarchy UI). */
export function filterCategoriesByAllowlist(
  categories: InventoryCategory[],
  allowlist: string[] | null
): InventoryCategory[] {
  if (!allowlist?.length) return categories;

  const keep = collectAllowlistKeepIds(categories, allowlist);
  if (keep.size === 0) return [];

  return categories.filter((c) => keep.has(c.id));
}

/** Union of descendant UUIDs for each allowlisted term (for default product scope). */
export function collectAllowlistScopeIds(
  categories: InventoryCategory[],
  allowlist: string[] | null
): string[] | null {
  if (!allowlist?.length) return null;

  const matched = categories.filter((c) => categoryMatchesAllowlist(c, allowlist));
  if (matched.length === 0) return [];

  const ids = new Set<string>();
  for (const cat of matched) {
    for (const id of collectDescendantIds(categories, cat.id)) {
      ids.add(id);
    }
  }
  return Array.from(ids);
}

export function getTopLevelCategories(categories: InventoryCategory[]): InventoryCategory[] {
  return categories.filter((c) => !c.parentId);
}

export function getChildren(
  categories: InventoryCategory[],
  parentId: string
): InventoryCategory[] {
  return categories.filter((c) => c.parentId === parentId);
}

export function collectDescendantIds(categories: InventoryCategory[], rootId: string): string[] {
  const ids: string[] = [rootId];
  const children = getChildren(categories, rootId);
  for (const child of children) {
    ids.push(...collectDescendantIds(categories, child.id));
  }
  return ids;
}

export function compareCategoriesForDisplay(a: InventoryCategory, b: InventoryCategory): number {
  const weightA = a.weight ?? 0;
  const weightB = b.weight ?? 0;
  if (weightA !== weightB) return weightA - weightB;

  const orderA = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
  const orderB = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) return orderA - orderB;

  return a.name.localeCompare(b.name);
}

export function sortTopLevelCategories(categories: InventoryCategory[]): InventoryCategory[] {
  return [...getTopLevelCategories(categories)].sort(compareCategoriesForDisplay);
}

export function sortChildCategories(
  categories: InventoryCategory[],
  parentId: string
): InventoryCategory[] {
  return getChildren(categories, parentId).sort(compareCategoriesForDisplay);
}
