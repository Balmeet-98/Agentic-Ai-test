"use client";

import { MapPin, Tag, Check, ChevronRight, Sparkles } from "lucide-react";
import type { InventoryItem } from "@/lib/inventory-types";

function categoryBadgeClass(category: string): string {
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  const palettes = [
    "bg-amber-500/15 text-amber-300 border-amber-500/25",
    "bg-sky-500/15 text-sky-300 border-sky-500/25",
    "bg-indigo-500/15 text-indigo-300 border-indigo-500/25",
    "bg-orange-500/15 text-orange-300 border-orange-500/25",
    "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/25",
    "bg-rose-500/15 text-rose-300 border-rose-500/25",
    "bg-teal-500/15 text-teal-300 border-teal-500/25",
  ];
  return palettes[Math.abs(hash) % palettes.length];
}

interface Props {
  item: InventoryItem;
  selected?: boolean;
  onSelect: (item: InventoryItem) => void;
  onConfirm?: () => void;
}

export default function ProductCard({ item, selected, onSelect, onConfirm }: Props) {
  const badgeClass = categoryBadgeClass(item.category);

  const cardClass = `group relative w-full text-left rounded-2xl overflow-hidden border transition-all duration-200 ${
    selected
      ? "border-violet-500/60 bg-violet-500/8 ring-1 ring-violet-500/30"
      : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.15] hover:bg-white/[0.06]"
  }`;

  return (
    <div className={cardClass}>
      <button
        type="button"
        onClick={() => onSelect(item)}
        aria-label={`Select ${item.name}`}
        aria-pressed={selected}
        className="w-full text-left"
      >
        {selected && (
          <div className="absolute top-2.5 right-2.5 z-10 w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center shadow-lg pointer-events-none">
            <Check size={12} className="text-white" />
          </div>
        )}

        <div className="relative w-full aspect-square overflow-hidden bg-white/[0.04]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          <div className="absolute top-2.5 left-2.5 right-8">
            <span
              className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border max-w-full truncate ${badgeClass}`}
              title={item.category}
            >
              {item.category}
            </span>
          </div>
        </div>

        <div className={`p-3 ${selected ? "pb-2" : ""}`}>
          <p className="font-semibold text-white/90 text-[13px] leading-snug line-clamp-2 mb-2">
            {item.name}
          </p>

          {/* <div className="flex items-center gap-2 flex-wrap mb-2.5">
            {item.location !== "—" && (
              <>
                <span className="flex items-center gap-1 text-[10px] text-white/45">
                  <MapPin size={9} className="flex-shrink-0" />
                  {item.location}
                </span>
                <span className="w-[3px] h-[3px] rounded-full bg-white/20 flex-shrink-0" />
              </>
            )}
            {item.color !== "—" && (
              <span className="flex items-center gap-1 text-[10px] text-white/35">
                <Tag size={9} className="flex-shrink-0" />
                {item.color}
              </span>
            )}
          </div> */}

          <p className={`text-[10px] text-white/35 font-mono ${selected ? "" : "mb-3"}`}>
            {item.sku}
          </p>

          {!selected && (
            <div className="flex items-center justify-between text-[11px] font-semibold text-white/40 group-hover:text-violet-300 transition-colors">
              <span>Select product</span>
              <ChevronRight
                size={13}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </div>
          )}
        </div>
      </button>

      {selected && onConfirm && (
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={onConfirm}
            aria-label={`Describe changes for ${item.name}`}
            className="product-card-cta w-full flex items-center justify-between gap-2 rounded-lg border border-violet-400/45 bg-gradient-to-r from-violet-500/25 via-fuchsia-500/15 to-violet-500/20 px-2.5 py-1.5 hover:from-violet-500/35 hover:to-fuchsia-500/25 transition-colors"
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <Sparkles size={11} className="text-fuchsia-300/90 flex-shrink-0" />
              <span className="text-[11px] font-semibold text-violet-100 truncate">
                Describe changes
              </span>
            </span>
            <ChevronRight
              size={13}
              className="product-card-cta-icon text-violet-200 flex-shrink-0"
            />
          </button>
        </div>
      )}
    </div>
  );
}
