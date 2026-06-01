import type { InventoryItem } from "@/lib/inventory-types";

export type { InventoryItem } from "@/lib/inventory-types";

/** @deprecated Use dynamic categories from /api/inventory/categories */
export type ProductCategory = string;

/** @deprecated Use /api/inventory/categories */
export const CATEGORIES: string[] = [
  "Hat",
  "T-Shirt",
  "Hoodie",
  "Mug",
  "Keychain",
  "Magnet",
];

export const MOCK_INVENTORY: InventoryItem[] = [
  {
    id: "hat-001",
    sku: "TST-HAT-001",
    name: "Halifax Harbour Baseball Cap",
    category: "Hat",
    categoryId: "hat",
    location: "Halifax",
    color: "Navy",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Classic 6-panel structured cap with embroidered Halifax Harbour wordmark",
  },
  {
    id: "hat-002",
    sku: "TST-HAT-002",
    name: "Cape Breton Highland Snapback",
    category: "Hat",
    categoryId: "hat",
    location: "Cape Breton",
    color: "Heather Grey",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Adjustable snapback with Cape Breton Highland embroidery on front panel",
  },
  {
    id: "hat-003",
    sku: "TST-HAT-003",
    name: "Peggy's Cove Lighthouse Toque",
    category: "Hat",
    categoryId: "hat",
    location: "Peggy's Cove",
    color: "Red",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Warm knit toque with Peggy's Cove lighthouse silhouette motif",
  },
  {
    id: "tshirt-001",
    sku: "TST-TEE-001",
    name: "Halifax Waterfront T-Shirt",
    category: "T-Shirt",
    categoryId: "t-shirt",
    location: "Halifax",
    color: "Navy",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Cotton tee with Halifax waterfront skyline graphic",
  },
  {
    id: "tshirt-002",
    sku: "TST-TEE-002",
    name: "Cape Breton Island T-Shirt",
    category: "T-Shirt",
    categoryId: "t-shirt",
    location: "Cape Breton",
    color: "Forest Green",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Soft ring-spun tee featuring Cape Breton island map outline",
  },
  {
    id: "hoodie-001",
    sku: "TST-HDY-001",
    name: "Nova Scotia Anchor Hoodie",
    category: "Hoodie",
    categoryId: "hoodie",
    location: "Nova Scotia",
    color: "Heather Grey",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Pullover hoodie with Nova Scotia anchor emblem on chest",
  },
  {
    id: "mug-001",
    sku: "TST-MUG-001",
    name: "Halifax Harbour Mug",
    category: "Mug",
    categoryId: "mug",
    location: "Halifax",
    color: "White",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "11oz ceramic mug with Halifax harbour wrap print",
  },
  {
    id: "keychain-001",
    sku: "TST-KEY-001",
    name: "Lighthouse Keychain",
    category: "Keychain",
    categoryId: "keychain",
    location: "Peggy's Cove",
    color: "Silver",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Metal keychain with Peggy's Cove lighthouse charm",
  },
  {
    id: "magnet-001",
    sku: "TST-MAG-001",
    name: "Peggy's Cove Magnet",
    category: "Magnet",
    categoryId: "magnet",
    location: "Peggy's Cove",
    color: "Full Colour",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Classic Peggy's Cove lighthouse souvenir magnet",
  },
];

/** @deprecated Use MOCK_INVENTORY */
export const INVENTORY = MOCK_INVENTORY;

export function searchMockInventory(
  query: string,
  category: string | "All"
): InventoryItem[] {
  const q = query.trim().toLowerCase();
  return MOCK_INVENTORY.filter((item) => {
    const matchesCategory = category === "All" || item.category === category;
    const matchesQuery =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.location.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q);
    return matchesCategory && matchesQuery;
  });
}

/** @deprecated Use searchMockInventory or /api/inventory */
export function searchInventory(
  query: string,
  category: string | "All"
): InventoryItem[] {
  return searchMockInventory(query, category);
}
