"use client";

import { useEffect, useRef } from "react";
import { Check, ChevronRight, Sparkles } from "lucide-react";
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
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selected) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cardRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest",
    });
  }, [selected]);

  const cardClass = `product-card group relative w-full h-full text-left rounded-2xl border transition-all duration-200 ${
    selected
      ? "z-10 border-violet-500/60 bg-violet-500/8 ring-1 ring-violet-500/30 shadow-lg shadow-violet-900/20"
      : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.15] hover:bg-white/[0.06]"
  }`;

  return (
    <div ref={cardRef} className={cardClass}>
      <button
        type="button"
        onClick={() => onSelect(item)}
        aria-label={`Select ${item.name}`}
        aria-pressed={selected}
        className="flex flex-col flex-1 min-h-0 w-full text-left"
      >
        {selected && (
          <div className="absolute top-2.5 right-2.5 z-10 w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center shadow-lg pointer-events-none">
            <Check size={12} className="text-white" />
          </div>
        )}

        <div className="relative w-full aspect-square overflow-hidden bg-white/[0.04] flex-shrink-0">
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

        <div className="flex flex-col flex-1 p-3 pb-2 min-h-0">
          <p className="product-card__title font-semibold text-white/90 text-[13px] leading-snug mb-2">
            {item.name}
          </p>

          <p className="text-[10px] text-white/35 font-mono truncate">{item.sku}</p>
        </div>
      </button>

      <div className="product-card__footer px-3 pb-3 flex-shrink-0">
        {selected && onConfirm ? (
          <button
            type="button"
            onClick={onConfirm}
            aria-label={`Describe changes for ${item.name}`}
            className="product-card-cta w-full h-full flex items-center justify-between gap-2 rounded-lg border border-violet-400/45 bg-gradient-to-r from-violet-500/25 via-fuchsia-500/15 to-violet-500/20 px-2.5 py-1.5 hover:from-violet-500/35 hover:to-fuchsia-500/25 transition-colors"
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
        ) : (
          <button
            type="button"
            onClick={() => onSelect(item)}
            className="w-full h-full flex items-center justify-between text-[11px] font-semibold text-white/40 group-hover:text-violet-300 transition-colors"
          >
            <span>Select product</span>
            <ChevronRight
              size={13}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </button>
        )}
      </div>
    </div>
  );
}
