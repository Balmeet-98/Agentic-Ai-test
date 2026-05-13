"use client";

import { useState } from "react";
import {
  Wand2,
  Package,
  AlertCircle,
  ChevronDown,
  Sparkles,
  ArrowRight,
  Bot,
  Upload,
  X,
  Check,
} from "lucide-react";
import ImageDropzone from "@/components/ImageDropzone";
import ResultPanel from "@/components/ResultPanel";
import StepBadge from "@/components/StepBadge";
import DesignChat from "@/components/DesignChat";

type DesignTab = "create" | "upload";

interface SelectedDesign {
  base64: string;
  mimeType: string;
  previewUrl: string;
}

function base64ToFile(base64: string, mimeType: string, filename: string): File {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new File([bytes], filename, { type: mimeType });
}

export default function Home() {
  // ── Product state ──────────────────────────────────────────────────────────
  const [productFile, setProductFile] = useState<File | null>(null);
  const [shakeProduct, setShakeProduct] = useState(false);

  // ── Design state ───────────────────────────────────────────────────────────
  const [designTab, setDesignTab] = useState<DesignTab>("create");
  const [designFile, setDesignFile] = useState<File | null>(null);
  const [selectedDesign, setSelectedDesign] = useState<SelectedDesign | null>(null);
  const [shakeDesign, setShakeDesign] = useState(false);

  // ── Generation state ───────────────────────────────────────────────────────
  const [placement, setPlacement] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resultDataUrl, setResultDataUrl] = useState<string | null>(null);
  const [resultBase64, setResultBase64] = useState<string | null>(null);
  const [resultMime, setResultMime] = useState("image/png");
  const [error, setError] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);

  // ── Derived flags ──────────────────────────────────────────────────────────
  const hasProduct = !!productFile;
  const hasDesign =
    (designTab === "upload" && !!designFile) ||
    (designTab === "create" && !!selectedDesign);

  const triggerShake = (setter: (v: boolean) => void) => {
    setter(true);
    setTimeout(() => setter(false), 500);
  };

  // ── Generate ───────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (isLoading) return;
    if (!hasProduct && !hasDesign) {
      triggerShake(setShakeProduct);
      triggerShake(setShakeDesign);
      return;
    }
    if (!hasProduct) { triggerShake(setShakeProduct); return; }
    if (!hasDesign)  { triggerShake(setShakeDesign);  return; }

    setIsLoading(true);
    setError(null);
    setResultBase64(null);
    setResultDataUrl(null);
    setModelUsed(null);

    try {
      const fd = new FormData();
      fd.append("product", productFile!);

      if (designTab === "upload" && designFile) {
        fd.append("design", designFile);
      } else if (selectedDesign) {
        const ext = selectedDesign.mimeType.split("/")[1] ?? "png";
        fd.append(
          "design",
          base64ToFile(selectedDesign.base64, selectedDesign.mimeType, `design.${ext}`)
        );
      }

      if (placement.trim()) fd.append("placement", placement);

      const res = await fetch("/api/generate", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        if (data.invalidProduct) triggerShake(setShakeProduct);
        throw new Error(data.error ?? "Unknown server error.");
      }

      setResultBase64(data.imageBase64);
      setResultDataUrl(`data:${data.mimeType ?? "image/png"};base64,${data.imageBase64}`);
      setResultMime(data.mimeType ?? "image/png");
      setModelUsed(data.modelUsed ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Reset ──────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setProductFile(null);
    setDesignFile(null);
    setSelectedDesign(null);
    setPlacement("");
    setResultBase64(null);
    setResultDataUrl(null);
    setError(null);
    setAdvancedOpen(false);
    setModelUsed(null);
    setShakeProduct(false);
    setShakeDesign(false);
  };

  const TABS: { id: DesignTab; label: string; icon: React.ReactNode }[] = [
    { id: "create", label: "Create with AI", icon: <Bot size={13} /> },
    { id: "upload", label: "Upload artwork",  icon: <Upload size={13} /> },
  ];

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
              <Package size={15} className="text-white" />
            </div>
            <span className="font-bold text-white text-[15px] tracking-tight">
              Merch <span className="text-violet-400">Designer</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 text-[11px] text-white/50 bg-white/[0.07] border border-white/[0.12] rounded-full px-3.5 py-1.5">
            <Sparkles size={10} className="text-violet-400" />
            Nano Banana 2 · gemini-3.1-flash-image-preview
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
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12">

        {/* Hero */}
        <div className="text-center mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 text-[11px] text-violet-400/90 bg-violet-500/10 border border-violet-500/20 rounded-full px-3.5 py-1.5 mb-5 font-medium tracking-wide">
            <Wand2 size={11} />
            AI-POWERED MERCHANDISE MOCKUP GENERATOR
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-[52px] font-extrabold text-white tracking-tight leading-[1.12] mb-4">
            Design &amp; preview{" "}
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
                any merchandise
              </span>
              <span className="absolute -bottom-1 left-0 right-0 h-px bg-gradient-to-r from-violet-400/0 via-fuchsia-400/50 to-violet-400/0" />
            </span>
            {" "}with AI
          </h1>

          <p className="text-white/60 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Upload any product — T-shirts, mugs, hats, bags, umbrellas &amp; more.
            Chat with AI to create your artwork, or upload an existing design.
            Gemini places it on the product in seconds.
          </p>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-8 sm:mb-10 flex-wrap">
          <StepBadge step={1} label="Upload Product" active done={hasProduct} />
          <ArrowRight size={12} className="text-white/15 flex-shrink-0" />
          <StepBadge step={2} label="Design" active={hasProduct} done={hasDesign} />
          <ArrowRight size={12} className="text-white/15 flex-shrink-0" />
          <StepBadge step={3} label="Generate" active={hasProduct && hasDesign} done={!!resultBase64} />
          <ArrowRight size={12} className="text-white/15 flex-shrink-0" />
          <StepBadge step={4} label="Download" active={!!resultBase64} done={false} />
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

        {/* Two-column layout */}
        <div className="grid lg:grid-cols-[1fr_1fr] gap-4 sm:gap-6 items-start">

          {/* ── Left: inputs ──────────────────────────────────────────────── */}
          <div className="flex flex-col gap-4">

            {/* 1. Product upload */}
            <div className={`glass rounded-2xl p-4 sm:p-5 transition-all duration-200 ${
              shakeProduct ? "shake ring-2 ring-red-500/40" : ""
            }`}>
              {shakeProduct && !hasProduct && (
                <p className="flex items-center gap-1.5 text-xs text-red-400 mb-3 font-medium">
                  <AlertCircle size={13} />
                  Please upload a product photo (T-shirt, mug, hat, bag, etc.)
                </p>
              )}
              <ImageDropzone
                label="Product Photo"
                sublabel="T-shirt, mug, hat, bag, umbrella, phone case — any merchandise"
                file={productFile}
                onFile={(f) => { setProductFile(f); if (f) setShakeProduct(false); }}
                index={1}
              />
            </div>

            {/* 2. Design source (tabbed) */}
            <div className={`glass rounded-2xl overflow-hidden transition-all duration-200 ${
              shakeDesign ? "shake ring-2 ring-red-500/40" : ""
            }`}>

              {/* Tab bar */}
              <div className="flex border-b border-white/[0.08]">
                {TABS.map((tab) => {
                  const isActive = designTab === tab.id;
                  const isDone =
                    (tab.id === "upload" && !!designFile) ||
                    (tab.id === "create" && !!selectedDesign);

                  return (
                    <button
                      key={tab.id}
                      onClick={() => setDesignTab(tab.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-2 text-[11px] font-semibold transition-all border-b-2 ${
                        isActive
                          ? "text-violet-300 border-violet-500 bg-violet-500/8"
                          : "text-white/40 border-transparent hover:text-white/65 hover:bg-white/4"
                      }`}
                    >
                      <span className={isActive ? "text-violet-400" : "text-white/30"}>
                        {tab.icon}
                      </span>
                      {tab.label}
                      {isDone && (
                        <span className="w-3.5 h-3.5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                          <Check size={8} className="text-white" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div className="p-4 sm:p-5">
                {shakeDesign && !hasDesign && (
                  <p className="flex items-center gap-1.5 text-xs text-red-400 mb-3 font-medium">
                    <AlertCircle size={13} />
                    {designTab === "create"
                      ? "Chat with AI to create a design, then click \"Use this design\""
                      : "Please upload a design image"}
                  </p>
                )}

                {/* Create with AI */}
                {designTab === "create" && (
                  <DesignChat
                    onDesignSelect={(base64, mimeType, previewUrl) => {
                      setSelectedDesign({ base64, mimeType, previewUrl });
                      if (base64) setShakeDesign(false);
                    }}
                  />
                )}

                {/* Upload artwork */}
                {designTab === "upload" && (
                  <ImageDropzone
                    label="Design / Artwork"
                    sublabel="Logo, graphic, illustration — any image to apply"
                    file={designFile}
                    onFile={(f) => { setDesignFile(f); if (f) setShakeDesign(false); }}
                    index={2}
                  />
                )}

                {/* Selected design preview (create tab) */}
                {designTab === "create" && selectedDesign && (
                  <div className="mt-3 pt-3 border-t border-white/8">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold text-green-400 flex items-center gap-1.5">
                        <Check size={11} />
                        Design ready to apply
                      </p>
                      <button
                        onClick={() => setSelectedDesign(null)}
                        className="text-white/30 hover:text-white/60 transition-colors"
                        title="Clear selection"
                      >
                        <X size={13} />
                      </button>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedDesign.previewUrl}
                      alt="Selected design"
                      className="w-full rounded-xl border border-white/10 object-contain"
                      style={{ maxHeight: "96px" }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 3. Advanced / placement */}
            <div className="glass rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setAdvancedOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 sm:px-5 py-3.5 text-sm text-white/55 hover:text-white/85 transition-colors"
              >
                <span className="font-medium">Advanced options</span>
                <ChevronDown
                  size={15}
                  className={`transition-transform duration-200 ${advancedOpen ? "rotate-180 text-violet-400" : ""}`}
                />
              </button>
              {advancedOpen && (
                <div className="px-4 sm:px-5 pb-5 border-t border-white/[0.06] pt-4">
                  <label className="block mb-2 text-xs font-semibold text-white/55 uppercase tracking-wider">
                    Placement hint
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. centered chest, top-left, across the back, wrap around mug…"
                    value={placement}
                    onChange={(e) => setPlacement(e.target.value)}
                    className="w-full bg-white/4 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60 focus:bg-violet-500/4 transition-all"
                  />
                  <p className="text-[11px] text-white/35 mt-2">
                    Optional: tell Gemini where to place the design on the product.
                  </p>
                </div>
              )}
            </div>

            {/* 4. Generate button */}
            <button
              type="button"
              onClick={handleGenerate}
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
              {isLoading ? "Generating…" : "Generate Mockup"}
            </button>

            <p className="text-center text-[11px] text-white/30">
              Gemini AI validates your product image before generating
            </p>
          </div>

          {/* ── Right: result ─────────────────────────────────────────────── */}
          <div className="glass rounded-2xl p-4 sm:p-5 lg:sticky lg:top-20">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-bold text-sm text-white/95">Result</p>
                <p className="text-[11px] text-white/45 mt-0.5">AI-generated mockup</p>
              </div>
              {resultBase64 && modelUsed && (
                <div className="flex items-center gap-1.5 text-[10px] bg-violet-500/12 border border-violet-500/25 text-violet-300 rounded-full px-2.5 py-1 font-medium">
                  <Sparkles size={9} />
                  {modelUsed.replace("gemini-", "").replace("-preview", "")}
                </div>
              )}
              {resultBase64 && !modelUsed && (
                <span className="text-[10px] bg-green-500/12 border border-green-500/25 text-green-400 rounded-full px-2.5 py-1">
                  Ready
                </span>
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

        {/* ── How it works ──────────────────────────────────────────────── */}
        <div className="mt-16 sm:mt-24">
          <div className="text-center mb-8">
            <p className="text-[11px] text-violet-400/70 uppercase tracking-[0.2em] font-semibold mb-2">Process</p>
            <h2 className="text-xl sm:text-2xl font-bold text-white/85">How it works</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4">
            {[
              {
                num: "01",
                icon: "📦",
                title: "Upload Your Product",
                desc: "Photo of any merchandise — T-shirt, mug, hat, bag, umbrella, and more.",
              },
              {
                num: "02",
                icon: "🎨",
                title: "Create or Upload Design",
                desc: "Chat with AI to generate custom artwork, or upload your own file.",
              },
              {
                num: "03",
                icon: "✨",
                title: "Gemini Composites",
                desc: "Nano Banana 2 analyses the product surface and realistically applies your design.",
              },
              {
                num: "04",
                icon: "⬇️",
                title: "Download Mockup",
                desc: "Export a high-quality PNG ready for stores, presentations, or social media.",
              },
            ].map((item) => (
              <div key={item.num} className="glass rounded-2xl p-5 sm:p-6 group hover:border-white/12 transition-all">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-[11px] font-bold text-violet-400/50 font-mono mt-0.5">{item.num}</span>
                  <span className="text-2xl">{item.icon}</span>
                </div>
                <p className="font-semibold text-white/90 text-sm mb-2">{item.title}</p>
                <p className="text-xs text-white/55 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.10] mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-white/35">
          <span>Merch Designer · AI Mockup Generator</span>
          <span>Powered by Nano Banana 2 · Next.js 15</span>
        </div>
      </footer>
    </div>
  );
}
