"use client";

import { MapPin, Tag, Check, ChevronRight } from "lucide-react";
import type { InventoryItem, ProductCategory } from "@/lib/inventory";

const CATEGORY_COLORS: Record<ProductCategory, string> = {
  Hat: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  "T-Shirt": "bg-sky-500/15 text-sky-300 border-sky-500/25",
  Hoodie: "bg-indigo-500/15 text-indigo-300 border-indigo-500/25",
  Mug: "bg-orange-500/15 text-orange-300 border-orange-500/25",
  Keychain: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  Magnet: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/25",
};

interface Props {
  item: InventoryItem;
  selected?: boolean;
  onSelect: (item: InventoryItem) => void;
}

export default function ProductCard({ item, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`group relative w-full text-left rounded-2xl overflow-hidden border transition-all duration-200 ${
        selected
          ? "border-violet-500/60 bg-violet-500/8 ring-1 ring-violet-500/30"
          : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.15] hover:bg-white/[0.06]"
      }`}
    >
      {/* Selected indicator */}
      {selected && (
        <div className="absolute top-2.5 right-2.5 z-10 w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center shadow-lg">
          <Check size={12} className="text-white" />
        </div>
      )}

      {/* Product image */}
      <div className="relative w-full aspect-square overflow-hidden bg-white/[0.04]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.imageUrl}
          alt={item.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* Category badge */}
        <div className="absolute top-2.5 left-2.5">
          <span
            className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              CATEGORY_COLORS[item.category]
            }`}
          >
            {item.category}
          </span>
        </div>
      </div>

      {/* Product info */}
      <div className="p-3">
        <p className="font-semibold text-white/90 text-[13px] leading-snug line-clamp-2 mb-2">
          {item.name}
        </p>

        <div className="flex items-center gap-2 flex-wrap mb-2.5">
          <span className="flex items-center gap-1 text-[10px] text-white/45">
            <MapPin size={9} className="flex-shrink-0" />
            {item.location}
          </span>
          <span className="w-[3px] h-[3px] rounded-full bg-white/20 flex-shrink-0" />
          <span className="flex items-center gap-1 text-[10px] text-white/35">
            <Tag size={9} className="flex-shrink-0" />
            {item.color}
          </span>
        </div>

        <p className="text-[10px] text-white/35 font-mono mb-3">{item.sku}</p>

        {/* Select action */}
        <div
          className={`flex items-center justify-between text-[11px] font-semibold transition-colors ${
            selected
              ? "text-violet-300"
              : "text-white/40 group-hover:text-violet-300"
          }`}
        >
          <span>{selected ? "Selected" : "Select product"}</span>
          <ChevronRight size={13} className={`transition-transform ${selected ? "" : "group-hover:translate-x-0.5"}`} />
        </div>
      </div>
    </button>
  );
}
