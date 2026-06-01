export interface InventoryCategory {
  id: string;
  name: string;
  imageUrl?: string;
  parentId?: string;
  weight?: number;
  displayOrder?: number | null;
  pathAlias?: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  categoryId?: string;
  location: string;
  color: string;
  imageUrl: string;
  description: string;
}

export interface PaginatedInventory {
  items: InventoryItem[];
  total: number;
  page: number;
  pageSize: number;
  source: "drupal" | "database" | "mock";
}
