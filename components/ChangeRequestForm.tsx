"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Wand2,
  MapPin,
  Tag,
  AlertCircle,
  Info,
  ArrowRight,
} from "lucide-react";
import type { InventoryItem } from "@/lib/inventory";

export interface TextChange {
  field: string;
  label: string;
  from: string;
  to: string;
}

interface Props {
  product: InventoryItem;
  onBack: () => void;
  onGenerate: (changes: TextChange[]) => void;
  isLoading: boolean;
}

export default function ChangeRequestForm({
  product,
  onBack,
  onGenerate,
  isLoading,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(product.editableFields.map((f) => [f.field, ""]))
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleChange = (field: string, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setValidationError(null);
  };

  const handleSubmit = () => {
    const changes: TextChange[] = product.editableFields
      .filter((f) => {
        const newVal = values[f.field]?.trim();
        return newVal && newVal !== f.currentValue;
      })
      .map((f) => ({
        field: f.field,
        label: f.label,
        from: f.currentValue,
        to: values[f.field].trim(),
      }));

    if (changes.length === 0) {
      setValidationError(
        "No changes entered. Fill in at least one field with a new value."
      );
      return;
    }

    onGenerate(changes);
  };

  const activeChanges = product.editableFields.filter((f) => {
    const v = values[f.field]?.trim();
    return v && v !== f.currentValue;
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        disabled={isLoading}
        className="flex items-center gap-1.5 text-[12px] text-white/45 hover:text-white/70 transition-colors self-start disabled:opacity-40"
      >
        <ArrowLeft size={13} />
        Back to inventory
      </button>

      {/* Selected product summary */}
      <div className="glass rounded-2xl p-4 flex gap-4 items-start">
        <div className="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden bg-white/[0.06] border border-white/[0.08]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white/95 text-sm leading-snug">{product.name}</p>
          <p className="text-[11px] font-mono text-white/35 mt-0.5">{product.sku}</p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-[11px] text-white/45">
              <MapPin size={9} />
              {product.location}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-white/40">
              <Tag size={9} />
              {product.color}
            </span>
          </div>
        </div>
      </div>

      {/* Instruction */}
      <div className="flex items-start gap-2.5 bg-violet-500/8 border border-violet-500/20 rounded-xl px-3.5 py-3">
        <Info size={14} className="text-violet-400 mt-0.5 flex-shrink-0" />
        <p className="text-[12px] text-violet-200/80 leading-relaxed">
          Enter new values for any fields below. Leave blank to keep the current value. AI will regenerate the product with only the specified text changed.
        </p>
      </div>

      {/* Editable fields */}
      <div className="flex flex-col gap-3">
        <p className="text-[11px] text-white/50 uppercase tracking-wider font-semibold">
          Text fields to modify
        </p>
        {product.editableFields.map((field) => {
          const newVal = values[field.field]?.trim();
          const hasChange = newVal && newVal !== field.currentValue;
          return (
            <div key={field.field} className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[12px] font-semibold text-white/80">
                  {field.label}
                </p>
                {hasChange && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                    <ArrowRight size={9} />
                    Will change
                  </span>
                )}
              </div>

              {/* Current → New layout */}
              <div className="flex items-center gap-2 mb-2.5">
                <div className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2">
                  <p className="text-[9px] text-white/35 uppercase tracking-wider mb-0.5">Current</p>
                  <p className="text-[13px] text-white/60 font-medium">{field.currentValue}</p>
                </div>
                <ArrowRight size={14} className="text-white/20 flex-shrink-0" />
                <div className="flex-1">
                  <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 focus-within:border-violet-500/50 focus-within:bg-violet-500/4 transition-all">
                    <p className="text-[9px] text-white/35 uppercase tracking-wider mb-0.5">New value</p>
                    <input
                      type="text"
                      value={values[field.field] ?? ""}
                      onChange={(e) => handleChange(field.field, e.target.value)}
                      placeholder={field.currentValue}
                      disabled={isLoading}
                      className="w-full bg-transparent text-[13px] text-white font-medium placeholder-white/20 focus:outline-none disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Change summary */}
      {activeChanges.length > 0 && (
        <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl px-4 py-3">
          <p className="text-[11px] font-semibold text-emerald-400 mb-2">
            {activeChanges.length} change{activeChanges.length !== 1 ? "s" : ""} queued
          </p>
          <div className="flex flex-col gap-1">
            {activeChanges.map((f) => (
              <p key={f.field} className="text-[11px] text-emerald-300/70">
                <span className="font-medium">{f.label}:</span>{" "}
                <span className="line-through text-white/35">{f.currentValue}</span>{" "}
                <ArrowRight size={9} className="inline text-emerald-400/60" />{" "}
                <span className="text-emerald-200">{values[f.field]}</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Validation error */}
      {validationError && (
        <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/25 rounded-xl px-3.5 py-3">
          <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-[12px] text-red-300">{validationError}</p>
        </div>
      )}

      {/* Generate button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isLoading}
        className={`group relative flex items-center justify-center gap-2.5 py-4 rounded-2xl font-bold text-[15px] transition-all duration-200 overflow-hidden ${
          isLoading
            ? "bg-violet-600/50 text-white/50 cursor-not-allowed"
            : "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white cursor-pointer hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-violet-500/30 active:translate-y-0 active:scale-[0.99]"
        }`}
      >
        {!isLoading && (
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
        )}
        <Wand2 size={18} />
        {isLoading ? "Generating mockup…" : "Generate Modified Mockup"}
      </button>

      {!isLoading && (
        <p className="text-center text-[11px] text-white/30">
          Gemini AI will apply your text changes to the product
        </p>
      )}
    </div>
  );
}
