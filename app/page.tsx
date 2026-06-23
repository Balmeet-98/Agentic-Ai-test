"use client";

import { useState, useRef } from "react";
import {
  Package,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Anchor,
  FileText,
} from "lucide-react";
import InventoryBrowser from "@/components/InventoryBrowser";
import PdfImageImporter from "@/components/PdfImageImporter";
import EditRequestChat from "@/components/EditRequestChat";
import ResultPanel from "@/components/ResultPanel";
import StepBadge from "@/components/StepBadge";
import type { InventoryItem } from "@/lib/inventory-types";
import {
  revokeExtractedImages,
  type ExtractedPdfImage,
} from "@/lib/pdf-extract-images";

type AppStep = "browse" | "edit" | "final";
type ImageSource = "catalogue" | "pdf";
type BrowseMode = "catalogue" | "pdf";

const PDF_PRODUCT: InventoryItem = {
  id: "pdf-import",
  sku: "PDF",
  name: "Imported PDF image",
  category: "Imported",
  location: "",
  color: "",
  imageUrl: "",
  description: "",
};

export default function Home() {
  const [step, setStep] = useState<AppStep>("browse");
  const [browseMode, setBrowseMode] = useState<BrowseMode>("catalogue");
  const [imageSource, setImageSource] = useState<ImageSource>("catalogue");
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
  const [selectedPdfImage, setSelectedPdfImage] = useState<ExtractedPdfImage | null>(null);
  const selectedPdfImageRef = useRef<ExtractedPdfImage | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultDataUrl, setResultDataUrl] = useState<string | null>(null);
  const [resultBase64, setResultBase64] = useState<string | null>(null);
  const [resultMime, setResultMime] = useState("image/png");
  const [modelUsed, setModelUsed] = useState<string | null>(null);

  // Current mockup in edit loop (to pass to AI for iterative edits)
  const [editMockupBase64, setEditMockupBase64] = useState<string | null>(null);
  const [editMockupMime, setEditMockupMime] = useState<string | null>(null);
  const [editHistory, setEditHistory] = useState<string[]>([]);
  const editMockupRef = useRef<{ base64: string; mime: string } | null>(null);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const resetEditSession = () => {
    setResultBase64(null);
    setResultDataUrl(null);
    setEditMockupBase64(null);
    setEditMockupMime(null);
    setEditHistory([]);
    editMockupRef.current = null;
    setModelUsed(null);
  };

  const clearPdfSelection = () => {
    if (selectedPdfImage) {
      revokeExtractedImages([selectedPdfImage]);
    }
    setSelectedPdfImage(null);
    selectedPdfImageRef.current = null;
  };

  const handleBrowseModeChange = (mode: BrowseMode) => {
    setBrowseMode(mode);
    if (mode === "catalogue") {
      clearPdfSelection();
    } else {
      setSelectedProduct(null);
    }
  };

  const handleSelectProduct = (item: InventoryItem) => {
    if (selectedProduct?.id !== item.id) {
      resetEditSession();
    }
    clearPdfSelection();
    setImageSource("catalogue");
    setBrowseMode("catalogue");
    setSelectedProduct(item);
  };

  const handleSelectPdfImage = (image: ExtractedPdfImage | null) => {
    if (image?.id !== selectedPdfImage?.id) {
      resetEditSession();
    }
    setSelectedProduct(null);
    setImageSource("pdf");
    setBrowseMode("pdf");
    setSelectedPdfImage(image);
    selectedPdfImageRef.current = image;
  };

  const handleConfirmProduct = () => {
    if (!selectedProduct) return;
    resetEditSession();
    setImageSource("catalogue");
    setStep("edit");
    setError(null);
  };

  const handleConfirmPdfImage = () => {
    if (!selectedPdfImage) return;
    resetEditSession();
    setImageSource("pdf");
    setStep("edit");
    setError(null);
  };

  const handleEditSubmit = async (description: string): Promise<{ dataUrl: string }> => {
    const editProduct = activeProduct;
    if (!editProduct || isLoading) {
      throw new Error("Cannot submit while loading.");
    }

    setIsLoading(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append("productName", editProduct.name);
      fd.append("category", editProduct.category);
      fd.append("description", description);

      const pdfImage = selectedPdfImageRef.current;

      if (imageSource === "pdf" && pdfImage) {
        fd.append("product", pdfImage.file, pdfImage.file.name);
      } else if (imageSource === "catalogue" && selectedProduct) {
        fd.append("productImageUrl", selectedProduct.imageUrl);
      } else {
        throw new Error("No product image available for editing.");
      }

      const prevMockup = editMockupRef.current;
      if (prevMockup) {
        const prevImageBuffer = Buffer.from(prevMockup.base64, "base64");
        const prevFile = new File([prevImageBuffer], "previous.png", {
          type: prevMockup.mime,
        });
        fd.append("previousImage", prevFile);
      }

      if (editHistory.length > 0) {
        fd.append("priorEdits", JSON.stringify(editHistory));
      }

      const res = await fetch("/api/modify", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Unknown server error.");
      }

      if (!data.imageBase64) {
        throw new Error("No image returned from the AI service.");
      }

      const mime = data.mimeType ?? "image/png";
      const dataUrl = `data:${mime};base64,${data.imageBase64}`;

      setEditMockupBase64(data.imageBase64);
      setEditMockupMime(mime);
      editMockupRef.current = { base64: data.imageBase64, mime };
      setEditHistory((prev) => [...prev, description]);
      setResultBase64(data.imageBase64);
      setResultDataUrl(dataUrl);
      setResultMime(mime);
      setModelUsed(data.modelUsed ?? null);

      return { dataUrl };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      setError(message);
      throw e instanceof Error ? e : new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDone = () => {
    setStep("final");
  };

  const handleReset = () => {
    setStep("browse");
    setBrowseMode("catalogue");
    setImageSource("catalogue");
    setSelectedProduct(null);
    clearPdfSelection();
    resetEditSession();
    setError(null);
  };

  // ── Derived ────────────────────────────────────────────────────────────
  const stepIndex = step === "browse" ? 0 : step === "edit" ? 1 : 2;

  const activeProduct: InventoryItem | null =
    imageSource === "catalogue" && selectedProduct
      ? selectedProduct
      : imageSource === "pdf" && selectedPdfImage
        ? { ...PDF_PRODUCT, imageUrl: selectedPdfImage.previewUrl }
        : null;

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
            </div>
          </div>

          {/* <div className="hidden md:flex items-center gap-2 text-[11px] text-white/50 bg-white/[0.07] border border-white/[0.12] rounded-full px-3.5 py-1.5">
            <Sparkles size={10} className="text-violet-400" />
            AI Mockup · gemini-3.1-flash-image-preview
          </div> */}

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
            INVENTORY MODIFIER 
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight mb-3">
            Find a product,{" "}
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
              request changes
            </span>
          </h1>

          <p className="text-white/55 text-sm max-w-lg mx-auto leading-relaxed">
            Browse the catalogue or import individual images from a PDF, describe your changes in natural language, and AI will iteratively regenerate the mockup.
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
            label="Edit & Iterate"
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
          <div className="flex flex-col gap-5">
            <div
              role="tablist"
              aria-label="Image source"
              className="flex p-1 rounded-xl bg-white/[0.04] border border-white/[0.08] max-w-md mx-auto w-full"
            >
              <button
                type="button"
                role="tab"
                aria-selected={browseMode === "catalogue"}
                onClick={() => handleBrowseModeChange("catalogue")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                  browseMode === "catalogue"
                    ? "bg-gradient-to-r from-violet-600/90 to-fuchsia-600/90 text-white shadow-lg shadow-violet-500/20"
                    : "text-white/50 hover:text-white/75 hover:bg-white/[0.04]"
                }`}
              >
                <Package size={15} />
                Catalogue
                {selectedProduct && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                )}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={browseMode === "pdf"}
                onClick={() => handleBrowseModeChange("pdf")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                  browseMode === "pdf"
                    ? "bg-gradient-to-r from-violet-600/90 to-fuchsia-600/90 text-white shadow-lg shadow-violet-500/20"
                    : "text-white/50 hover:text-white/75 hover:bg-white/[0.04]"
                }`}
              >
                <FileText size={15} />
                PDF Import
                {selectedPdfImage && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                )}
              </button>
            </div>

            <div className="glass rounded-2xl p-4 sm:p-6">
              {browseMode === "catalogue" ? (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <p className="font-bold text-white/95 text-base">Product Catalogue</p>
                      <p className="text-[12px] text-white/40 mt-0.5">
                        Select a product to modify
                      </p>
                    </div>
                    {selectedProduct && (
                      <div className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1 font-medium">
                        1 product selected
                      </div>
                    )}
                  </div>
                  <InventoryBrowser
                    selectedId={selectedProduct?.id}
                    onSelect={handleSelectProduct}
                    onConfirmSelection={handleConfirmProduct}
                  />
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <p className="font-bold text-white/95 text-base">Import from PDF</p>
                      <p className="text-[12px] text-white/40 mt-0.5">
                        Pick from the shared library or upload a new PDF, then select an image
                      </p>
                    </div>
                    {selectedPdfImage && (
                      <div className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1 font-medium">
                        1 PDF image selected
                      </div>
                    )}
                  </div>
                  <PdfImageImporter
                    selectedId={selectedPdfImage?.id ?? null}
                    onSelect={handleSelectPdfImage}
                    onConfirmSelection={handleConfirmPdfImage}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Step 2: Edit loop ─────────────────────────────────────────── */}
        {step === "edit" && activeProduct && (
          <div className="glass rounded-2xl p-3 sm:p-5 lg:p-6">
            <EditRequestChat
              key={activeProduct.id + (selectedPdfImage?.id ?? selectedProduct?.id ?? "")}
              product={activeProduct}
              currentMockup={
                resultDataUrl
                  ? { dataUrl: resultDataUrl, base64: resultBase64!, mimeType: resultMime }
                  : null
              }
              isLoading={isLoading}
              onSubmitEdit={handleEditSubmit}
              onBack={() => {
                setStep("browse");
                setBrowseMode(imageSource === "pdf" ? "pdf" : "catalogue");
                setError(null);
                resetEditSession();
              }}
              onDone={handleDone}
            />
          </div>
        )}

        {/* ── Step 3: Final preview + download ────────────────────────── */}
        {step === "final" && activeProduct && (
          <div className="glass rounded-2xl p-4 sm:p-6 max-w-2xl mx-auto">
            <div className="text-center mb-5">
              <p className="font-bold text-white/95 text-base">Final Result</p>
              <p className="text-[12px] text-white/40 mt-1">Ready to download</p>
            </div>

            <ResultPanel
              imageBase64={resultBase64}
              dataUrl={resultDataUrl}
              mimeType={resultMime}
              isLoading={false}
              onReset={handleReset}
            />

            {/* {modelUsed && (
              <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] bg-violet-500/12 border border-violet-500/25 text-violet-300 rounded-full px-2.5 py-1 font-medium w-fit mx-auto">
                <Sparkles size={9} />
                {modelUsed.replace("gemini-", "").replace("-preview", "")}
              </div>
            )} */}
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
                  title: "Browse or Import",
                  desc: "Pick a product from the catalogue, or upload a PDF and select an individual design image to start from.",
                },
                {
                  num: "02",
                  title: "Describe Changes",
                  desc: "Tell AI what to change in natural language — 'change Halifax to Cape Breton', 'bold the text', 'adjust colors', etc.",
                },
                {
                  num: "03",
                  title: "Iterate & Download",
                  desc: "AI regenerates the mockup. Keep requesting edits until perfect, then download the final PNG.",
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
          <span>Tall Ships Trading </span>
        </div>
      </footer>
    </div>
  );
}
