import {
  collectAllowlistScopeIds,
  collectDescendantIds,
  parseCategoryAllowlist,
} from "@/lib/category-tree";
import {
  fetchAllCategories,
  fetchVariationsPage,
  getCachedCategories,
  isDrupalConfigured,
} from "@/lib/drupal";
import type {
  InventoryCategory,
  InventoryItem,
  PaginatedInventory,
} from "@/lib/inventory-types";
import { MOCK_INVENTORY, searchMockInventory } from "@/lib/inventory";

export interface ListProductsParams {
  categoryId?: string;
  q?: string;
  page: number;
  pageSize: number;
}

export interface InventoryRepository {
  listCategories(): Promise<InventoryCategory[]>;
  listProducts(params: ListProductsParams): Promise<PaginatedInventory>;
}

class DrupalInventoryRepository implements InventoryRepository {
  async listCategories(): Promise<InventoryCategory[]> {
    return fetchAllCategories();
  }

  async listProducts(params: ListProductsParams): Promise<PaginatedInventory> {
    const categories = await getCachedCategories();
    let categoryIds: string[] | undefined;

    if (params.categoryId) {
      categoryIds = collectDescendantIds(categories, params.categoryId);
    } else {
      const scopeIds = collectAllowlistScopeIds(categories, parseCategoryAllowlist());
      if (scopeIds) categoryIds = scopeIds;
    }

    if (categoryIds && categoryIds.length === 0) {
      return {
        items: [],
        total: 0,
        page: params.page,
        pageSize: params.pageSize,
        source: "drupal",
      };
    }

    const { items, total } = await fetchVariationsPage({
      ...params,
      categoryIds,
      categoryId: undefined,
    });
    return {
      items,
      total,
      page: params.page,
      pageSize: params.pageSize,
      source: "drupal",
    };
  }
}

class MockInventoryRepository implements InventoryRepository {
  async listCategories(): Promise<InventoryCategory[]> {
    const seen = new Map<string, InventoryCategory>();
    for (const item of MOCK_INVENTORY) {
      const id = item.categoryId ?? item.category;
      if (!seen.has(id)) {
        seen.set(id, { id, name: item.category });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async listProducts(params: ListProductsParams): Promise<PaginatedInventory> {
    const globalSearch = Boolean(params.q?.trim());
    const categoryName =
      !globalSearch && params.categoryId
        ? MOCK_INVENTORY.find(
            (i) =>
              i.categoryId === params.categoryId || i.category === params.categoryId
          )?.category
        : undefined;

    let filtered = searchMockInventory(params.q ?? "", categoryName ?? "All");

    if (!globalSearch && params.categoryId && categoryName) {
      filtered = filtered.filter(
        (i) => i.categoryId === params.categoryId || i.category === categoryName
      );
    } else if (!globalSearch && params.categoryId) {
      filtered = filtered.filter(
        (i) => i.categoryId === params.categoryId || i.category === params.categoryId
      );
    }

    const total = filtered.length;
    const start = (params.page - 1) * params.pageSize;
    const items = filtered.slice(start, start + params.pageSize);

    return {
      items,
      total,
      page: params.page,
      pageSize: params.pageSize,
      source: "mock",
    };
  }
}

class SupabaseInventoryRepository implements InventoryRepository {
  async listCategories(): Promise<InventoryCategory[]> {
    throw new Error("Supabase inventory is not configured. Set INVENTORY_SOURCE=drupal or complete Phase 2 setup.");
  }

  async listProducts(): Promise<PaginatedInventory> {
    throw new Error("Supabase inventory is not configured. Set INVENTORY_SOURCE=drupal or complete Phase 2 setup.");
  }
}

let repository: InventoryRepository | null = null;

export function getInventoryRepository(): InventoryRepository {
  if (repository) return repository;

  const source = process.env.INVENTORY_SOURCE?.trim().toLowerCase() ?? "drupal";

  if (source === "database") {
    repository = new SupabaseInventoryRepository();
  } else if (source === "mock" || !isDrupalConfigured()) {
    repository = new MockInventoryRepository();
  } else {
    repository = new DrupalInventoryRepository();
  }

  return repository;
}

export type { InventoryCategory, InventoryItem, PaginatedInventory };
