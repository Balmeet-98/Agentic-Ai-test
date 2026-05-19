export type ProductCategory =
  | "Hat"
  | "T-Shirt"
  | "Hoodie"
  | "Mug"
  | "Keychain"
  | "Magnet";

export const CATEGORIES: ProductCategory[] = [
  "Hat",
  "T-Shirt",
  "Hoodie",
  "Mug",
  "Keychain",
  "Magnet",
];

export interface EditableField {
  label: string;
  field: string;
  currentValue: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  location: string;
  color: string;
  imageUrl: string;
  description: string;
  editableFields: EditableField[];
}

export const INVENTORY: InventoryItem[] = [
  // ── Hats ──────────────────────────────────────────────────────────────────
  {
    id: "hat-001",
    sku: "TST-HAT-001",
    name: "Halifax Harbour Baseball Cap",
    category: "Hat",
    location: "Halifax",
    color: "Navy",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Classic 6-panel structured cap with embroidered Halifax Harbour wordmark",
    editableFields: [
      { label: "Location Name", field: "location", currentValue: "Halifax" },
      { label: "Tagline", field: "tagline", currentValue: "Halifax Harbour" },
    ],
  },
  {
    id: "hat-002",
    sku: "TST-HAT-002",
    name: "Cape Breton Highland Snapback",
    category: "Hat",
    location: "Cape Breton",
    color: "Heather Grey",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Adjustable snapback with Cape Breton Highland embroidery on front panel",
    editableFields: [
      { label: "Location Name", field: "location", currentValue: "Cape Breton" },
      { label: "Subtitle", field: "subtitle", currentValue: "Highland" },
    ],
  },
  {
    id: "hat-003",
    sku: "TST-HAT-003",
    name: "Peggy's Cove Lighthouse Toque",
    category: "Hat",
    location: "Peggy's Cove",
    color: "Red",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Warm knit toque with Peggy's Cove lighthouse silhouette motif",
    editableFields: [
      { label: "Location Name", field: "location", currentValue: "Peggy's Cove" },
      { label: "Icon Label", field: "iconLabel", currentValue: "Lighthouse" },
    ],
  },
  {
    id: "hat-004",
    sku: "TST-HAT-004",
    name: "Nova Scotia Heritage Cap",
    category: "Hat",
    location: "Nova Scotia",
    color: "Black",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Heritage-style cap with provincial Nova Scotia emblem and crest",
    editableFields: [
      { label: "Province Name", field: "location", currentValue: "Nova Scotia" },
      { label: "Year Mark", field: "year", currentValue: "Est. 1605" },
    ],
  },

  // ── T-Shirts ───────────────────────────────────────────────────────────────
  {
    id: "tshirt-001",
    sku: "TST-TS-001",
    name: "Halifax Waterfront Classic Tee",
    category: "T-Shirt",
    location: "Halifax",
    color: "White",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Soft 100% cotton tee with Halifax waterfront skyline screen-print",
    editableFields: [
      { label: "City Name", field: "location", currentValue: "Halifax" },
      { label: "Province Label", field: "province", currentValue: "Nova Scotia, Canada" },
    ],
  },
  {
    id: "tshirt-002",
    sku: "TST-TS-002",
    name: "Lunenburg Fisherman Tee",
    category: "T-Shirt",
    location: "Lunenburg",
    color: "Royal Blue",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Vintage-style tee featuring Lunenburg harbour scene with fishing vessel",
    editableFields: [
      { label: "Town Name", field: "location", currentValue: "Lunenburg" },
      { label: "Tagline", field: "tagline", currentValue: "Historic Waterfront" },
    ],
  },
  {
    id: "tshirt-003",
    sku: "TST-TS-003",
    name: "Cape Breton Island Sunset Tee",
    category: "T-Shirt",
    location: "Cape Breton",
    color: "Charcoal",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Dusk-toned graphic tee featuring Cape Breton island silhouette at sunset",
    editableFields: [
      { label: "Island Name", field: "location", currentValue: "Cape Breton" },
      { label: "Province", field: "province", currentValue: "Nova Scotia" },
    ],
  },
  {
    id: "tshirt-004",
    sku: "TST-TS-004",
    name: "Annapolis Royal Heritage Tee",
    category: "T-Shirt",
    location: "Annapolis Royal",
    color: "Cream",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Heritage-print tee celebrating Annapolis Royal and Fort Anne National Site",
    editableFields: [
      { label: "Town Name", field: "location", currentValue: "Annapolis Royal" },
      { label: "Historic Site", field: "site", currentValue: "Fort Anne" },
    ],
  },

  // ── Hoodies ────────────────────────────────────────────────────────────────
  {
    id: "hoodie-001",
    sku: "TST-HD-001",
    name: "Halifax Pullover Hoodie",
    category: "Hoodie",
    location: "Halifax",
    color: "Navy",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Heavyweight 80% cotton fleece pullover with Halifax chest embroidery",
    editableFields: [
      { label: "City Name", field: "location", currentValue: "Halifax" },
      { label: "Province Label", field: "province", currentValue: "Nova Scotia" },
    ],
  },
  {
    id: "hoodie-002",
    sku: "TST-HD-002",
    name: "Yarmouth Zip-Front Hoodie",
    category: "Hoodie",
    location: "Yarmouth",
    color: "Forest Green",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Full-zip fleece hoodie with Yarmouth Cape Forchu lighthouse emblem",
    editableFields: [
      { label: "Town Name", field: "location", currentValue: "Yarmouth" },
      { label: "Emblem Text", field: "emblem", currentValue: "Cape Forchu Light" },
    ],
  },
  {
    id: "hoodie-003",
    sku: "TST-HD-003",
    name: "Peggy's Cove Souvenir Hoodie",
    category: "Hoodie",
    location: "Peggy's Cove",
    color: "White",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Soft pullover hoodie with iconic Peggy's Cove rocky coast illustration",
    editableFields: [
      { label: "Location Name", field: "location", currentValue: "Peggy's Cove" },
      { label: "Province", field: "province", currentValue: "Nova Scotia" },
    ],
  },

  // ── Mugs ───────────────────────────────────────────────────────────────────
  {
    id: "mug-001",
    sku: "TST-MUG-001",
    name: "Halifax Harbour Coffee Mug",
    category: "Mug",
    location: "Halifax",
    color: "White",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Ceramic 11 oz mug with wrap-around Halifax Harbour waterfront panorama",
    editableFields: [
      { label: "City Name", field: "location", currentValue: "Halifax" },
      { label: "Tagline", field: "tagline", currentValue: "Harbour City" },
    ],
  },
  {
    id: "mug-002",
    sku: "TST-MUG-002",
    name: "Cape Breton Highlands Mug",
    category: "Mug",
    location: "Cape Breton",
    color: "White",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Ceramic mug with Cape Breton Highland landscape and Cabot Trail motif",
    editableFields: [
      { label: "Region Name", field: "location", currentValue: "Cape Breton" },
      { label: "Feature Name", field: "feature", currentValue: "Cabot Trail" },
    ],
  },
  {
    id: "mug-003",
    sku: "TST-MUG-003",
    name: "Nova Scotia Wildlife Mug",
    category: "Mug",
    location: "Nova Scotia",
    color: "Black",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Bold black ceramic mug with Nova Scotia wildlife illustration",
    editableFields: [
      { label: "Province Name", field: "location", currentValue: "Nova Scotia" },
      { label: "Wildlife Label", field: "wildlife", currentValue: "Black Bear" },
    ],
  },
  {
    id: "mug-004",
    sku: "TST-MUG-004",
    name: "Lunenburg Colour Houses Mug",
    category: "Mug",
    location: "Lunenburg",
    color: "White",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Vibrant mug featuring Lunenburg's UNESCO heritage colourful homes",
    editableFields: [
      { label: "Town Name", field: "location", currentValue: "Lunenburg" },
      { label: "Heritage Tag", field: "heritage", currentValue: "UNESCO World Heritage" },
    ],
  },

  // ── Keychains ──────────────────────────────────────────────────────────────
  {
    id: "keychain-001",
    sku: "TST-KC-001",
    name: "Halifax Lobster Keychain",
    category: "Keychain",
    location: "Halifax",
    color: "Red/Brass",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Hand-painted resin lobster keychain with Halifax text on brass tag",
    editableFields: [
      { label: "City Name", field: "location", currentValue: "Halifax" },
    ],
  },
  {
    id: "keychain-002",
    sku: "TST-KC-002",
    name: "Peggy's Cove Lighthouse Keychain",
    category: "Keychain",
    location: "Peggy's Cove",
    color: "White/Red",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Die-cast metal lighthouse keychain engraved with Peggy's Cove",
    editableFields: [
      { label: "Location Name", field: "location", currentValue: "Peggy's Cove" },
    ],
  },
  {
    id: "keychain-003",
    sku: "TST-KC-003",
    name: "Nova Scotia Bluenose Keychain",
    category: "Keychain",
    location: "Nova Scotia",
    color: "Brass",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Brass Bluenose II schooner keychain stamped with Nova Scotia",
    editableFields: [
      { label: "Province Name", field: "location", currentValue: "Nova Scotia" },
      { label: "Ship Name", field: "ship", currentValue: "Bluenose II" },
    ],
  },
  {
    id: "keychain-004",
    sku: "TST-KC-004",
    name: "Cape Breton Fiddle Keychain",
    category: "Keychain",
    location: "Cape Breton",
    color: "Maple Wood",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Laser-engraved maple wood fiddle keychain with Cape Breton text",
    editableFields: [
      { label: "Region Name", field: "location", currentValue: "Cape Breton" },
      { label: "Subtitle", field: "subtitle", currentValue: "Celtic Music Capital" },
    ],
  },

  // ── Magnets ────────────────────────────────────────────────────────────────
  {
    id: "magnet-001",
    sku: "TST-MAG-001",
    name: "Halifax Cityscape Fridge Magnet",
    category: "Magnet",
    location: "Halifax",
    color: "Full Colour",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Full-colour fridge magnet featuring Halifax downtown skyline",
    editableFields: [
      { label: "City Name", field: "location", currentValue: "Halifax" },
      { label: "Subtitle", field: "subtitle", currentValue: "Nova Scotia" },
    ],
  },
  {
    id: "magnet-002",
    sku: "TST-MAG-002",
    name: "Cape Breton Sunrise Magnet",
    category: "Magnet",
    location: "Cape Breton",
    color: "Full Colour",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Landscape magnet with Cape Breton sunrise over the Bras d'Or Lakes",
    editableFields: [
      { label: "Island Name", field: "location", currentValue: "Cape Breton" },
      { label: "Feature", field: "feature", currentValue: "Bras d'Or Lakes" },
    ],
  },
  {
    id: "magnet-003",
    sku: "TST-MAG-003",
    name: "Lunenburg Heritage Magnet",
    category: "Magnet",
    location: "Lunenburg",
    color: "Full Colour",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Colourful heritage magnet of Lunenburg Old Town waterfront",
    editableFields: [
      { label: "Town Name", field: "location", currentValue: "Lunenburg" },
      { label: "Area Tag", field: "tag", currentValue: "Old Town" },
    ],
  },
  {
    id: "magnet-004",
    sku: "TST-MAG-004",
    name: "Peggy's Cove Iconic Magnet",
    category: "Magnet",
    location: "Peggy's Cove",
    color: "Full Colour",
    imageUrl: "/products/halifax-anchor-cap.jpg",
    description: "Classic Peggy's Cove lighthouse and rock scene souvenir magnet",
    editableFields: [
      { label: "Location Name", field: "location", currentValue: "Peggy's Cove" },
    ],
  },
];

export function searchInventory(
  query: string,
  category: ProductCategory | "All"
): InventoryItem[] {
  const q = query.trim().toLowerCase();
  return INVENTORY.filter((item) => {
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
