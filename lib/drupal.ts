import type { InventoryCategory, InventoryItem } from "@/lib/inventory-types";
import {
  collectAllowlistScopeIds,
  filterCategoriesByAllowlist,
  parseCategoryAllowlist,
} from "@/lib/category-tree";

export {
  collectDescendantIds,
  getChildren,
  getTopLevelCategories,
  sortChildCategories,
  sortTopLevelCategories,
} from "@/lib/category-tree";

const DEFAULT_BASE = "https://www.tallshipstrading.com";

type JsonApiResource = {
  type: string;
  id: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<
    string,
    { data?: { type: string; id: string } | { type: string; id: string }[] | null }
  >;
};

type JsonApiDocument = {
  data?: JsonApiResource | JsonApiResource[];
  included?: JsonApiResource[];
  meta?: { count?: number; omitted?: { detail?: string } };
  errors?: { detail?: string; title?: string }[];
};

let cachedCookie: { value: string; expiresAt: number } | null = null;

function getBaseUrl(): string {
  return (process.env.DRUPAL_API_BASE ?? DEFAULT_BASE).replace(/\/$/, "");
}

function buildAuthHeader(): string | null {
  const key = process.env.DRUPAL_API_KEY?.trim();
  if (!key) return null;
  return `Basic ${key}`;
}

async function loginSession(): Promise<string> {
  if (cachedCookie && cachedCookie.expiresAt > Date.now()) {
    return cachedCookie.value;
  }

  const user = process.env.DRUPAL_USERNAME?.trim() ?? "guest";
  const pass = process.env.DRUPAL_PASSWORD?.trim() ?? "1712chris";
  const base = getBaseUrl();

  const res = await fetch(`${base}/user/login?_format=json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: user, pass }),
  });

  if (!res.ok) {
    throw new Error(`Drupal login failed (${res.status}). Check DRUPAL_USERNAME / DRUPAL_PASSWORD.`);
  }

  const setCookies =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [];

  if (setCookies.length === 0) {
    const single = res.headers.get("set-cookie");
    if (single) setCookies.push(single);
  }

  const cookie = setCookies.map((c) => c.split(";")[0]).join("; ");
  if (!cookie) {
    throw new Error("Drupal login succeeded but no session cookie was returned.");
  }

  cachedCookie = { value: cookie, expiresAt: Date.now() + 25 * 60 * 1000 };
  return cookie;
}

async function drupalFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = getBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    Accept: "application/vnd.api+json",
    ...(init?.headers as Record<string, string> | undefined),
  };

  const basic = buildAuthHeader();
  if (basic) headers.Authorization = basic;

  let res = await fetch(url, { ...init, headers });

  let needsSession = res.status === 403;
  if (!needsSession && res.ok) {
    const peek = (await res.clone().json()) as JsonApiDocument;
    const data = resourceList(peek);
    needsSession = data.length === 0 && Boolean(peek.meta?.omitted);
  }

  if (needsSession) {
    const cookie = await loginSession();
    const { Authorization: _removed, ...rest } = headers;
    res = await fetch(url, {
      ...init,
      headers: { ...rest, Cookie: cookie },
    });
  }

  return res;
}

async function parseJsonApi(res: Response): Promise<JsonApiDocument> {
  const json = (await res.json()) as JsonApiDocument;
  if (!res.ok) {
    const msg = json.errors?.[0]?.detail ?? json.errors?.[0]?.title ?? `Drupal API error (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

function resourceList(doc: JsonApiDocument): JsonApiResource[] {
  if (!doc.data) return [];
  return Array.isArray(doc.data) ? doc.data : [doc.data];
}

function includedMap(doc: JsonApiDocument): Map<string, JsonApiResource> {
  const map = new Map<string, JsonApiResource>();
  for (const item of doc.included ?? []) {
    map.set(`${item.type}:${item.id}`, item);
  }
  return map;
}

function resolveRelationship(
  resource: JsonApiResource,
  relName: string,
  included: Map<string, JsonApiResource>
): JsonApiResource | undefined {
  const rel = resource.relationships?.[relName]?.data;
  if (!rel || Array.isArray(rel)) {
    const first = Array.isArray(rel) ? rel[0] : undefined;
    if (!first) return undefined;
    return included.get(`${first.type}:${first.id}`);
  }
  return included.get(`${rel.type}:${rel.id}`);
}

function resolveRelationshipAll(
  resource: JsonApiResource,
  relName: string,
  included: Map<string, JsonApiResource>
): JsonApiResource[] {
  const rel = resource.relationships?.[relName]?.data;
  if (!rel) return [];
  const list = Array.isArray(rel) ? rel : [rel];
  return list
    .map((r) => included.get(`${r.type}:${r.id}`))
    .filter((r): r is JsonApiResource => Boolean(r));
}

export function absoluteFileUrl(uri: { url?: string; value?: string } | undefined): string | undefined {
  if (!uri?.url) return undefined;
  if (uri.url.startsWith("http")) return uri.url;
  return `${getBaseUrl()}${uri.url.startsWith("/") ? uri.url : `/${uri.url}`}`;
}

const DRUPAL_BATCH_SIZE = 50;
const VARIATION_JSONAPI_INCLUDE = "images,product_category,product_id";

function resolveFileFromResource(
  resource: JsonApiResource | undefined,
  included: Map<string, JsonApiResource>,
  depth = 0
): string | undefined {
  if (!resource || depth > 4) return undefined;

  if (resource.type === "file--file") {
    const uri = resource.attributes?.uri as { url?: string } | undefined;
    return absoluteFileUrl(uri);
  }

  const mediaRelKeys = [
    "field_media_image",
    "thumbnail",
    "image",
    "field_image",
  ];
  for (const key of mediaRelKeys) {
    const rel = resource.relationships?.[key]?.data;
    const ref = Array.isArray(rel) ? rel[0] : rel;
    if (!ref) continue;
    const nested = included.get(`${ref.type}:${ref.id}`);
    const url = resolveFileFromResource(nested, included, depth + 1);
    if (url) return url;
  }

  return undefined;
}

function resolveVariationImageUrl(
  variation: JsonApiResource,
  included: Map<string, JsonApiResource>
): string | undefined {
  const imageFiles = variation.relationships?.images?.data;
  const refs = !imageFiles ? [] : Array.isArray(imageFiles) ? imageFiles : [imageFiles];
  for (const ref of refs) {
    const resource = included.get(`${ref.type}:${ref.id}`);
    const url = resolveFileFromResource(resource, included);
    if (url) return url;
  }

  const product = resolveRelationship(variation, "product_id", included);
  if (product) {
    return resolveFileFromResource(product, included);
  }

  return undefined;
}

function stripHtml(html: string | undefined): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const LOCATION_HINTS = [
  "Halifax",
  "Cape Breton",
  "Peggy's Cove",
  "Peggys Cove",
  "Lunenburg",
  "Annapolis",
  "Yarmouth",
  "Sydney",
  "Nova Scotia",
  "Canada",
];

function inferLocation(title: string): string {
  for (const hint of LOCATION_HINTS) {
    if (title.toLowerCase().includes(hint.toLowerCase())) return hint;
  }
  return "—";
}

function inferColor(title: string, sku: string): string {
  const combined = `${title} ${sku}`.toLowerCase();
  const colors = [
    "navy",
    "black",
    "white",
    "red",
    "blue",
    "green",
    "grey",
    "gray",
    "heather",
    "pink",
    "yellow",
    "orange",
    "purple",
    "brown",
    "khaki",
  ];
  for (const c of colors) {
    if (combined.includes(c)) return c.charAt(0).toUpperCase() + c.slice(1);
  }
  return "—";
}

export function mapCategory(
  term: JsonApiResource,
  included: Map<string, JsonApiResource>
): InventoryCategory {
  const parentRel = term.relationships?.parent?.data;
  const parentId = Array.isArray(parentRel)
    ? parentRel[0]?.id
    : parentRel && !Array.isArray(parentRel)
      ? parentRel.id
      : undefined;

  let imageUrl: string | undefined;
  const imageRef = term.relationships?.category_image?.data;
  if (imageRef && !Array.isArray(imageRef)) {
    const file = included.get(`${imageRef.type}:${imageRef.id}`);
    const uri = file?.attributes?.uri as { url?: string } | undefined;
    imageUrl = absoluteFileUrl(uri);
  }

  const path = term.attributes?.path as { alias?: string } | undefined;
  const displayOrder = term.attributes?.display_order_override;
  const weight =
    typeof term.attributes?.weight === "number" ? term.attributes.weight : 0;

  return {
    id: term.id,
    name: String(term.attributes?.name ?? "Uncategorized"),
    imageUrl,
    parentId: parentId === "virtual" ? undefined : parentId,
    weight,
    displayOrder:
      typeof displayOrder === "number"
        ? displayOrder
        : displayOrder === null
          ? null
          : undefined,
    pathAlias: path?.alias,
  };
}

export function mapVariationToItem(
  variation: JsonApiResource,
  included: Map<string, JsonApiResource>
): InventoryItem | null {
  if (variation.attributes?.status === false) return null;

  const title = String(variation.attributes?.title ?? "Untitled product");
  const sku = String(variation.attributes?.sku ?? variation.id);

  const categories = resolveRelationshipAll(variation, "product_category", included);
  const categoryTerm = categories[0];
  const categoryName = categoryTerm
    ? String(categoryTerm.attributes?.name ?? "General")
    : "General";
  const categoryId = categoryTerm?.id;

  const imageUrl = resolveVariationImageUrl(variation, included);
  if (!imageUrl) return null;

  const product = resolveRelationship(variation, "product_id", included);
  const rawDesc = product?.attributes?.description as
    | { processed?: string; value?: string }
    | undefined;
  const description = stripHtml(rawDesc?.processed ?? rawDesc?.value).slice(0, 500);

  return {
    id: variation.id,
    sku,
    name: title,
    category: categoryName,
    categoryId,
    location: inferLocation(title),
    color: inferColor(title, sku),
    imageUrl,
    description: description || title,
  };
}

export async function fetchAllCategories(): Promise<InventoryCategory[]> {
  const categories: InventoryCategory[] = [];
  let offset = 0;
  const limit = 50;

  while (true) {
    const res = await drupalFetch(
      `/jsonapi/taxonomy_term/product_category?page[limit]=${limit}&page[offset]=${offset}&include=category_image&sort=name`
    );
    const doc = await parseJsonApi(res);
    const terms = resourceList(doc);
    const included = includedMap(doc);

    for (const term of terms) {
      if (term.attributes?.status === false) continue;
      categories.push(mapCategory(term, included));
    }

    if (terms.length === 0) break;

    const totalCount = doc.meta?.count;
    offset += limit;
    if (typeof totalCount === "number") {
      if (offset >= totalCount) break;
    } else if (terms.length < limit) {
      break;
    }

    if (offset > 500) break;
  }

  const allowlist = parseCategoryAllowlist();
  return filterCategoriesByAllowlist(categories, allowlist);
}

let categoriesCache: {
  key: string;
  data: InventoryCategory[];
  expiresAt: number;
} | null = null;

function categoriesCacheKey(): string {
  const allowlist = parseCategoryAllowlist();
  return allowlist?.join("\0") ?? "__full_catalog__";
}

/** Cached category list for product filtering (same allowlist as fetchAllCategories). */
export async function getCachedCategories(): Promise<InventoryCategory[]> {
  const key = categoriesCacheKey();
  if (
    categoriesCache &&
    categoriesCache.key === key &&
    categoriesCache.expiresAt > Date.now()
  ) {
    return categoriesCache.data;
  }
  const data = await fetchAllCategories();
  categoriesCache = { key, data, expiresAt: Date.now() + 5 * 60 * 1000 };
  return data;
}

function buildCategoryIdFilters(categoryIds: string[]): string[] {
  if (categoryIds.length === 1) {
    return [`filter[product_category.id]=${encodeURIComponent(categoryIds[0])}`];
  }

  const filters: string[] = [
    "filter[product_category.id][operator]=IN",
  ];
  for (const id of categoryIds) {
    filters.push(
      `filter[product_category.id][value][]=${encodeURIComponent(id)}`
    );
  }
  return filters;
}

export interface FetchVariationsParams {
  categoryId?: string;
  categoryIds?: string[];
  q?: string;
  page: number;
  pageSize: number;
}

const mappableCountCache = new Map<string, { count: number; expiresAt: number }>();

function buildVariationFilters(params: FetchVariationsParams): string[] {
  const { categoryId, categoryIds, q } = params;
  const filters: string[] = [];
  const ids =
    categoryIds && categoryIds.length > 0
      ? categoryIds
      : categoryId
        ? [categoryId]
        : null;
  if (ids) {
    filters.push(...buildCategoryIdFilters(ids));
  }
  if (q?.trim()) {
    const term = encodeURIComponent(q.trim());
    filters.push(`filter[title][operator]=CONTAINS`);
    filters.push(`filter[title][value]=${term}`);
  }
  return filters;
}

async function fetchVariationBatch(
  drupalOffset: number,
  filters: string[]
): Promise<{
  variations: JsonApiResource[];
  included: Map<string, JsonApiResource>;
  exhausted: boolean;
}> {
  const query = [
    `page[limit]=${DRUPAL_BATCH_SIZE}`,
    `page[offset]=${drupalOffset}`,
    `include=${encodeURIComponent(VARIATION_JSONAPI_INCLUDE)}`,
    ...filters,
  ].join("&");

  const res = await drupalFetch(
    `/jsonapi/commerce_product_variation/default?${query}`
  );
  const doc = await parseJsonApi(res);
  const variations = resourceList(doc);
  return {
    variations,
    included: includedMap(doc),
    exhausted: variations.length < DRUPAL_BATCH_SIZE,
  };
}

function mapVariationsToItems(
  variations: JsonApiResource[],
  included: Map<string, JsonApiResource>
): InventoryItem[] {
  const items: InventoryItem[] = [];
  for (const variation of variations) {
    const item = mapVariationToItem(variation, included);
    if (item) items.push(item);
  }
  return items;
}

async function scanMappableVariations(
  filters: string[],
  targetSkip: number,
  targetTake: number
): Promise<{ items: InventoryItem[]; total: number }> {
  let drupalOffset = 0;
  let skipped = 0;
  let total = 0;
  const items: InventoryItem[] = [];

  while (true) {
    const batch = await fetchVariationBatch(drupalOffset, filters);
    const batchItems = mapVariationsToItems(batch.variations, batch.included);

    for (const item of batchItems) {
      total++;
      if (skipped < targetSkip) {
        skipped++;
        continue;
      }
      if (items.length < targetTake) {
        items.push(item);
      }
    }

    if (batch.exhausted) break;
    drupalOffset += DRUPAL_BATCH_SIZE;
  }

  return { items, total };
}

export async function fetchVariationsPage(
  params: FetchVariationsParams
): Promise<{ items: InventoryItem[]; total: number }> {
  const { categoryId, categoryIds, page, pageSize } = params;
  const filters = buildVariationFilters(params);

  const ids =
    categoryIds && categoryIds.length > 0
      ? categoryIds
      : categoryId
        ? [categoryId]
        : null;
  if (ids && ids.length === 0) {
    return { items: [], total: 0 };
  }

  const targetSkip = (page - 1) * pageSize;
  const targetTake = pageSize;
  const cacheKey = filters.join("\0");
  const cached = mappableCountCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    const { items } = await scanMappableVariations(filters, targetSkip, targetTake);
    return { items, total: cached.count };
  }

  const { items, total } = await scanMappableVariations(
    filters,
    targetSkip,
    targetTake
  );
  mappableCountCache.set(cacheKey, {
    count: total,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  return { items, total };
}

export function isDrupalConfigured(): boolean {
  return process.env.INVENTORY_SOURCE?.trim().toLowerCase() !== "mock";
}
