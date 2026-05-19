"use client";

import { useState } from "react";
import { Search, X, Package } from "lucide-react";
import { CATEGORIES, INVENTORY, searchInventory } from "@/lib/inventory";
import type { InventoryItem, ProductCategory } from "@/lib/inventory";
import ProductCard from "@/components/ProductCard";

interface Props {
  selectedId?: string | null;
  onSelect: (item: InventoryItem) => void;
}

export default function InventoryBrowser({ selectedId, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<ProductCategory | "All">("All");

  const results = searchInventory(query, activeCategory);

  const categoryCounts = (["All", ...CATEGORIES] as (ProductCategory | "All")[]).map(
    (cat) => ({
      cat,
      count:
        cat === "All"
          ? INVENTORY.length
          : INVENTORY.filter((i) => i.category === cat).length,
    })
  );

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
          placeholder="Search by name, location, or SKU…"
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

      {/* Category filter chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {categoryCounts.map(({ cat, count }) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${
              activeCategory === cat
                ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                : "bg-white/[0.04] border-white/[0.08] text-white/45 hover:border-white/[0.15] hover:text-white/70"
            }`}
          >
            {cat}
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                activeCategory === cat
                  ? "bg-violet-500/30 text-violet-200"
                  : "bg-white/[0.08] text-white/35"
              }`}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-white/40">
          {results.length === 0
            ? "No products found"
            : `${results.length} product${results.length !== 1 ? "s" : ""}${
                activeCategory !== "All" ? ` · ${activeCategory}` : ""
              }${query ? ` matching "${query}"` : ""}`}
        </p>
        {(query || activeCategory !== "All") && (
          <button
            type="button"
            onClick={() => { setQuery(""); setActiveCategory("All"); }}
            className="text-[11px] text-violet-400/70 hover:text-violet-300 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Product grid */}
      {results.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {results.map((item) => (
            <ProductCard
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
            <Package size={24} className="text-white/20" />
          </div>
          <div>
            <p className="text-white/60 font-medium text-sm">No products found</p>
            <p className="text-white/35 text-xs mt-1">Try a different search term or category</p>
          </div>
        </div>
      )}
    </div>
  );
}
