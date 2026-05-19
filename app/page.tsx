"use client";

import { useState } from "react";
import {
  Package,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Wand2,
  Anchor,
} from "lucide-react";
import InventoryBrowser from "@/components/InventoryBrowser";
import ChangeRequestForm from "@/components/ChangeRequestForm";
import ResultPanel from "@/components/ResultPanel";
import StepBadge from "@/components/StepBadge";
import type { InventoryItem } from "@/lib/inventory";
import type { TextChange } from "@/components/ChangeRequestForm";

type AppStep = "browse" | "change" | "result";

export default function Home() {
  const [step, setStep] = useState<AppStep>("browse");
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultDataUrl, setResultDataUrl] = useState<string | null>(null);
  const [resultBase64, setResultBase64] = useState<string | null>(null);
  const [resultMime, setResultMime] = useState("image/png");
  const [modelUsed, setModelUsed] = useState<string | null>(null);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSelectProduct = (item: InventoryItem) => {
    setSelectedProduct(item);
  };

  const handleConfirmProduct = () => {
    if (!selectedProduct) return;
    setStep("change");
    setError(null);
  };

  const handleGenerate = async (changes: TextChange[]) => {
    if (!selectedProduct || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResultBase64(null);
    setResultDataUrl(null);
    setModelUsed(null);

    try {
      // Fetch the product image from its URL, then send as a file
      const imageRes = await fetch(selectedProduct.imageUrl);
      if (!imageRes.ok) {
        throw new Error("Failed to load product image. Please try again.");
      }
      const imageBlob = await imageRes.blob();
      const mimeType = imageBlob.type || "image/jpeg";
      const ext = mimeType.split("/")[1] ?? "jpg";
      const productFile = new File([imageBlob], `product.${ext}`, { type: mimeType });

      const fd = new FormData();
      fd.append("product", productFile);
      fd.append("productName", selectedProduct.name);
      fd.append("category", selectedProduct.category);
      fd.append("changes", JSON.stringify(changes));

      const res = await fetch("/api/modify", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Unknown server error.");
      }

      setResultBase64(data.imageBase64);
      setResultDataUrl(`data:${data.mimeType ?? "image/png"};base64,${data.imageBase64}`);
      setResultMime(data.mimeType ?? "image/png");
      setModelUsed(data.modelUsed ?? null);
      setStep("result");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setStep("browse");
    setSelectedProduct(null);
    setResultBase64(null);
    setResultDataUrl(null);
    setError(null);
    setModelUsed(null);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const stepIndex = step === "browse" ? 0 : step === "change" ? 1 : 2;

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden">

      {/* ── Ambient background ────────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] rounded-full bg-fuchsia-600/15 blur-[130px]" />
        <div className="absolute top-1/2 left-0 w-[350px] h-[350px] rounded-full bg-indigo-600/12 blur-[100px] -translate-y-1/2" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.10] bg-[#13111f]/85 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Anchor size={14} className="text-white" />
            </div>
            <div>
              <span className="font-bold text-white text-[14px] tracking-tight block leading-none">
                Tall Ships <span className="text-violet-400">Trading</span>
              </span>
              <span className="text-[10px] text-white/35 tracking-wide">Sales Rep Tool</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 text-[11px] text-white/50 bg-white/[0.07] border border-white/[0.12] rounded-full px-3.5 py-1.5">
            <Sparkles size={10} className="text-violet-400" />
            AI Mockup · gemini-3.1-flash-image-preview
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-white/50 flex-shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="hidden sm:block">Live</span>
          </div>
        </div>
      </header>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-10">

        {/* Hero */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 text-[11px] text-violet-400/90 bg-violet-500/10 border border-violet-500/20 rounded-full px-3.5 py-1.5 mb-4 font-medium tracking-wide">
            <Package size={11} />
            INVENTORY MODIFIER · SALES REP TOOL
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight mb-3">
            Find a product,{" "}
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
              suggest a change
            </span>
          </h1>

          <p className="text-white/55 text-sm max-w-lg mx-auto leading-relaxed">
            Browse the Tall Ships Trading catalogue, select a product, and request a location name or text update. AI will generate a new mockup for download.
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-8 flex-wrap">
          <StepBadge
            step={1}
            label="Browse & Select"
            active
            done={stepIndex > 0}
          />
          <ArrowRight size={12} className="text-white/15 flex-shrink-0" />
          <StepBadge
            step={2}
            label="Request Changes"
            active={stepIndex >= 1}
            done={stepIndex > 1}
          />
          <ArrowRight size={12} className="text-white/15 flex-shrink-0" />
          <StepBadge
            step={3}
            label="Download"
            active={stepIndex >= 2}
            done={false}
          />
        </div>

        {/* Error toast */}
        {error && (
          <div className="mb-5 flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3.5">
            <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-300 leading-relaxed flex-1">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-400/50 hover:text-red-300 transition-colors flex-shrink-0 ml-1"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Step 1: Browse inventory ─────────────────────────────────── */}
        {step === "browse" && (
          <div className="flex flex-col gap-6">
            <div className="glass rounded-2xl p-4 sm:p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="font-bold text-white/95 text-base">Product Catalogue</p>
                  <p className="text-[12px] text-white/40 mt-0.5">
                    Select a product to modify
                  </p>
                </div>
                {selectedProduct && (
                  <div className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1 font-medium">
                    1 selected
                  </div>
                )}
              </div>
              <InventoryBrowser
                selectedId={selectedProduct?.id}
                onSelect={handleSelectProduct}
              />
            </div>

            {/* Confirm selection CTA */}
            {selectedProduct && (
              <div className="glass rounded-2xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden bg-white/[0.06] border border-white/[0.08]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/90 font-semibold text-sm truncate">
                    {selectedProduct.name}
                  </p>
                  <p className="text-[11px] text-white/40 mt-0.5">{selectedProduct.sku}</p>
                </div>
                <button
                  type="button"
                  onClick={handleConfirmProduct}
                  className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold px-4 py-2.5 rounded-xl transition-all text-sm hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-900/40 active:scale-[0.98] flex-shrink-0"
                >
                  Request Changes
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Change request + Result panel ───────────────────── */}
        {(step === "change" || step === "result") && selectedProduct && (
          <div className="grid lg:grid-cols-[1fr_1fr] gap-4 sm:gap-6 items-start">

            {/* Left: change form */}
            <div className="glass rounded-2xl p-4 sm:p-5">
              {step === "change" && (
                <ChangeRequestForm
                  product={selectedProduct}
                  onBack={() => { setStep("browse"); setError(null); }}
                  onGenerate={handleGenerate}
                  isLoading={isLoading}
                />
              )}
              {step === "result" && (
                <div className="flex flex-col gap-4">
                  {/* Product summary (read-only in result step) */}
                  <div className="flex gap-4 items-start">
                    <div className="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden bg-white/[0.06] border border-white/[0.08]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedProduct.imageUrl}
                        alt={selectedProduct.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="font-bold text-white/95 text-sm">{selectedProduct.name}</p>
                      <p className="text-[11px] font-mono text-white/35 mt-0.5">{selectedProduct.sku}</p>
                      <p className="text-[11px] text-emerald-400 mt-1.5">Mockup generated successfully</p>
                    </div>
                  </div>

                  <div className="h-px bg-white/[0.08]" />

                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex items-center justify-center gap-2 border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white font-semibold py-3 rounded-xl transition-all text-sm"
                  >
                    <Package size={14} />
                    Modify another product
                  </button>
                </div>
              )}
            </div>

            {/* Right: result panel */}
            <div className="glass rounded-2xl p-4 sm:p-5 lg:sticky lg:top-20">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-bold text-sm text-white/95">Modified Mockup</p>
                  <p className="text-[11px] text-white/45 mt-0.5">AI-generated product preview</p>
                </div>
                {resultBase64 && modelUsed && (
                  <div className="flex items-center gap-1.5 text-[10px] bg-violet-500/12 border border-violet-500/25 text-violet-300 rounded-full px-2.5 py-1 font-medium">
                    <Sparkles size={9} />
                    {modelUsed.replace("gemini-", "").replace("-preview", "")}
                  </div>
                )}
              </div>
              <div className="h-px bg-white/[0.10] mb-4" />
              <ResultPanel
                imageBase64={resultBase64}
                dataUrl={resultDataUrl}
                mimeType={resultMime}
                isLoading={isLoading}
                onReset={handleReset}
              />
            </div>
          </div>
        )}

        {/* ── How it works ──────────────────────────────────────────────── */}
        {step === "browse" && (
          <div className="mt-16 sm:mt-20">
            <div className="text-center mb-7">
              <p className="text-[11px] text-violet-400/70 uppercase tracking-[0.2em] font-semibold mb-2">Process</p>
              <h2 className="text-xl sm:text-2xl font-bold text-white/85">How it works</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              {[
                {
                  num: "01",
                  title: "Browse the Catalogue",
                  desc: "Search and filter 22+ products by category — hats, tees, mugs, keychains, magnets, and more.",
                },
                {
                  num: "02",
                  title: "Request a Text Change",
                  desc: "Choose a product and specify the new location name or text — e.g. 'Halifax' → 'Cape Breton'.",
                },
                {
                  num: "03",
                  title: "Download the Mockup",
                  desc: "Gemini AI regenerates the product with your updated text. Download the PNG for review or presentation.",
                },
              ].map((item) => (
                <div key={item.num} className="glass rounded-2xl p-5 sm:p-6">
                  <span className="text-[11px] font-bold text-violet-400/50 font-mono block mb-3">{item.num}</span>
                  <p className="font-semibold text-white/90 text-sm mb-2">{item.title}</p>
                  <p className="text-xs text-white/55 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.10] mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-white/35">
          <span>Tall Ships Trading · Sales Rep Inventory Tool</span>
          <span>Powered by Gemini AI · Next.js</span>
        </div>
      </footer>
    </div>
  );
}
