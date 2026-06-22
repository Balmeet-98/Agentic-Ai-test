"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  X,
  Package,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  sortChildCategories,
  sortTopLevelCategories,
} from "@/lib/category-tree";
import type { InventoryItem } from "@/lib/inventory-types";
import type { InventoryCategory } from "@/lib/inventory-types";
import ProductCard from "@/components/ProductCard";
import ProductCardSkeleton from "@/components/ProductCardSkeleton";

interface Props {
  selectedId?: string | null;
  onSelect: (item: InventoryItem) => void;
  onConfirmSelection?: () => void;
}

const PAGE_SIZE = 12;

function categoryIdForTopLevel(
  categories: InventoryCategory[],
  topLevelId: string
): string {
  const children = sortChildCategories(categories, topLevelId);
  return children.length > 0 ? children[0].id : topLevelId;
}

function chipClass(active: boolean, nested = false) {
  const base =
    "rounded-full text-[11px] font-semibold max-w-[220px] truncate px-3 py-1.5 transition-all border";
  if (active) {
    return `${base} bg-violet-500/25 border-violet-400/50 text-violet-100`;
  }
  if (nested) {
    return `${base} bg-white/[0.06] border-white/[0.08] text-white/55 hover:bg-white/[0.10] hover:text-white/75`;
  }
  return `${base} bg-white/[0.04] border-white/[0.08] text-white/55 hover:bg-white/[0.08] hover:text-white/75`;
}

export default function InventoryBrowser({
  selectedId,
  onSelect,
  onConfirmSelection,
}: Props) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeTopLevelId, setActiveTopLevelId] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [source, setSource] = useState<string | null>(null);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCategoriesLoading(true);
      setCategoriesError(null);
      try {
        const res = await fetch("/api/inventory/categories");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load categories.");
        if (!cancelled) setCategories(data.categories ?? []);
      } catch (e: unknown) {
        if (!cancelled) {
          setCategoriesError(e instanceof Error ? e.message : "Failed to load categories.");
        }
      } finally {
        if (!cancelled) setCategoriesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadProducts = useCallback(
    async (pageNum: number) => {
      setProductsLoading(true);
      setItems([]);
      setProductsError(null);
      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          pageSize: String(PAGE_SIZE),
        });
        const globalSearch = Boolean(debouncedQuery.trim());

        if (!globalSearch && !activeCategoryId) {
          setProductsLoading(false);
          setItems([]);
          setTotal(0);
          return;
        }

        if (!globalSearch && activeCategoryId) {
          params.set("categoryId", activeCategoryId);
        }
        if (globalSearch) {
          params.set("q", debouncedQuery.trim());
        }

        const res = await fetch(`/api/inventory?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load products.");

        setTotal(data.total ?? 0);
        setSource(data.source ?? null);
        setPage(data.page ?? pageNum);
        setItems(data.items ?? []);
      } catch (e: unknown) {
        setProductsError(e instanceof Error ? e.message : "Failed to load products.");
        setItems([]);
      } finally {
        setProductsLoading(false);
      }
    },
    [activeCategoryId, debouncedQuery]
  );

  useEffect(() => {
    if (!activeCategoryId) return;
    setPage(1);
    void loadProducts(1);
  }, [activeCategoryId, debouncedQuery, loadProducts]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const goToPage = (nextPage: number) => {
    const clamped = Math.max(1, Math.min(nextPage, totalPages));
    if (clamped === page || productsLoading) return;
    setPage(clamped);
    void loadProducts(clamped);
  };

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  const topLevelCategories = useMemo(
    () => sortTopLevelCategories(categories),
    [categories]
  );

  useEffect(() => {
    if (categoriesLoading || topLevelCategories.length === 0) return;
    if (
      activeTopLevelId &&
      topLevelCategories.some((c) => c.id === activeTopLevelId)
    ) {
      return;
    }
    const first = topLevelCategories[0];
    setActiveTopLevelId(first.id);
    setActiveCategoryId(categoryIdForTopLevel(categories, first.id));
  }, [categoriesLoading, topLevelCategories, categories, activeTopLevelId]);

  const subcategories = useMemo(() => {
    if (!activeTopLevelId) return [];
    return sortChildCategories(categories, activeTopLevelId);
  }, [categories, activeTopLevelId]);

  const activeTopLevelName = activeTopLevelId
    ? categories.find((c) => c.id === activeTopLevelId)?.name
    : null;

  const activeCategoryName = activeCategoryId
    ? (categories.find((c) => c.id === activeCategoryId)?.name ?? "Category")
    : "";

  const selectTopLevel = (topLevelId: string) => {
    setActiveTopLevelId(topLevelId);
    setActiveCategoryId(categoryIdForTopLevel(categories, topLevelId));
  };

  const showProductSkeletons = productsLoading && items.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35 pointer-events-none"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all products by name or SKU…"
          className="w-full bg-white/[0.05] border border-white/[0.10] rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-violet-500/50 focus:bg-violet-500/4 transition-all"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Category filters */}
      {categoriesError && (
        <div className="flex items-start gap-2 text-[12px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <span>{categoriesError}</span>
        </div>
      )}

      <div className="flex flex-col gap-3" role="group" aria-label="Product categories">
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold text-white/45 uppercase tracking-wide">
            Categories
          </p>
          {categoriesLoading ? (
            <div className="flex items-center gap-2 py-1 text-[12px] text-white/40">
              <Loader2 size={14} className="animate-spin text-violet-300/70" />
              Loading categories…
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {topLevelCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => selectTopLevel(cat.id)}
                  className={chipClass(activeTopLevelId === cat.id)}
                  aria-pressed={activeTopLevelId === cat.id}
                  title={cat.name}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {activeTopLevelName && subcategories.length > 0 && (
          <div
            className="rounded-xl border border-violet-500/25 bg-violet-500/[0.06] border-l-[3px] border-l-violet-400/60 pl-3 pr-3 py-2.5"
            role="group"
            aria-label={`Subcategories for ${activeTopLevelName}`}
          >
            <p className="text-[11px] font-semibold text-violet-300/90 uppercase tracking-wide mb-2">
              Subcategories · {activeTopLevelName}
            </p>
            <div className="flex flex-wrap gap-1.5 items-center">
              {subcategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategoryId(cat.id)}
                  className={chipClass(activeCategoryId === cat.id, true)}
                  aria-pressed={activeCategoryId === cat.id}
                  title={cat.name}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-white/40">
          {showProductSkeletons
            ? "Loading products…"
            : items.length === 0
              ? "No products found"
              : `Showing ${rangeStart}–${rangeEnd} of ${total} product${total !== 1 ? "s" : ""}${
                  debouncedQuery
                    ? ` matching "${debouncedQuery}" across all categories`
                    : activeCategoryName
                      ? ` · ${activeCategoryName}`
                      : ""
                }`}
          {source && (
            <span className="text-white/25 ml-1">({source})</span>
          )}
        </p>
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="text-[11px] text-violet-400/70 hover:text-violet-300 transition-colors"
          >
            Clear search
          </button>
        )}
      </div>

      {productsError && (
        <div className="flex items-start gap-2 text-[12px] text-red-300/90 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <span>{productsError}</span>
        </div>
      )}

      {/* Product grid */}
      {showProductSkeletons ? (
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 items-stretch"
          role="status"
          aria-live="polite"
          aria-label="Loading products"
        >
          <ProductCardSkeleton count={PAGE_SIZE} />
        </div>
      ) : items.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 items-stretch">
            {items.map((item) => (
              <ProductCard
                key={item.id}
                item={item}
                selected={item.id === selectedId}
                onSelect={onSelect}
                onConfirm={
                  item.id === selectedId ? onConfirmSelection : undefined
                }
              />
            ))}
          </div>

          {totalPages > 1 && (
            <nav
              className="flex flex-wrap items-center justify-center gap-2 pt-1"
              aria-label="Product pagination"
            >
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1 || productsLoading}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-white/[0.10] bg-white/[0.04] text-[12px] font-semibold text-white/60 hover:text-white/90 hover:border-violet-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
                Previous
              </button>

              <span className="text-[12px] text-white/50 px-2 tabular-nums">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages || productsLoading}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-white/[0.10] bg-white/[0.04] text-[12px] font-semibold text-white/60 hover:text-white/90 hover:border-violet-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </nav>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
            <Package size={24} className="text-white/20" />
          </div>
          <div>
            <p className="text-white/60 font-medium text-sm">No products found</p>
            <p className="text-white/35 text-xs mt-1">
              Try a different search term or category
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
