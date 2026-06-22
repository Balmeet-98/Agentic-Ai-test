"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  FileText,
  Loader2,
  AlertCircle,
  Check,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import {
  extractImagesFromPdf,
  revokeExtractedImages,
  type ExtractedPdfImage,
} from "@/lib/pdf-extract-images";

interface Props {
  selectedId: string | null;
  onSelect: (image: ExtractedPdfImage | null) => void;
  onConfirmSelection?: () => void;
}

export default function PdfImageImporter({
  selectedId,
  onSelect,
  onConfirmSelection,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const extractedRef = useRef<ExtractedPdfImage[]>([]);

  const [dragging, setDragging] = useState(false);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<ExtractedPdfImage[]>([]);
  const [truncated, setTruncated] = useState(false);

  const clearExtracted = useCallback(() => {
    revokeExtractedImages(extractedRef.current);
    extractedRef.current = [];
    setImages([]);
    setTruncated(false);
    onSelect(null);
  }, [onSelect]);

  useEffect(() => {
    return () => {
      revokeExtractedImages(extractedRef.current);
    };
  }, []);

  const processPdf = useCallback(
    async (file: File) => {
      clearExtracted();
      setError(null);
      setPdfName(file.name);
      setExtracting(true);

      try {
        const { images: extracted, truncated: wasTruncated } = await extractImagesFromPdf(file);
        extractedRef.current = extracted;
        setImages(extracted);
        setTruncated(wasTruncated);
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message : "Failed to extract images from PDF.";
        setError(message);
        setPdfName(null);
      } finally {
        setExtracting(false);
      }
    },
    [clearExtracted]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) void processPdf(dropped);
    },
    [processPdf]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) void processPdf(picked);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleReplacePdf = () => {
    clearExtracted();
    setPdfName(null);
    setError(null);
    inputRef.current?.click();
  };

  return (
    <div>
      {!pdfName && !extracting && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`relative rounded-xl border-2 border-dashed transition-all cursor-pointer p-8 text-center ${
            dragging
              ? "border-violet-400/70 bg-violet-500/10"
              : "border-white/[0.12] bg-white/[0.02] hover:border-white/[0.22] hover:bg-white/[0.04]"
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center mx-auto mb-3">
            <Upload size={20} className="text-violet-300" />
          </div>
          <p className="text-sm font-semibold text-white/85 mb-1">
            Drag & drop a PDF or click to browse
          </p>
          <p className="text-[11px] text-white/40">PDF · max 25 MB · individual images per page</p>
        </div>
      )}

      {extracting && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 size={24} className="text-violet-400 animate-spin" />
          <p className="text-sm text-white/60">Detecting individual images…</p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-red-300 leading-relaxed">{error}</p>
            <button
              type="button"
              onClick={handleReplacePdf}
              className="mt-2 text-[11px] text-red-300/80 hover:text-red-200 underline"
            >
              Try another PDF
            </button>
          </div>
        </div>
      )}

      {pdfName && !extracting && images.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <FileText size={14} className="text-violet-400 flex-shrink-0" />
              <span className="text-[12px] text-white/60 truncate" title={pdfName}>
                {pdfName}
              </span>
              <span className="text-[11px] text-white/35 flex-shrink-0">
                · {images.length} image{images.length !== 1 ? "s" : ""}
              </span>
            </div>
            <button
              type="button"
              onClick={handleReplacePdf}
              className="text-[11px] text-violet-300/80 hover:text-violet-200 transition-colors"
            >
              Replace PDF
            </button>
          </div>

          {truncated && (
            <p className="text-[11px] text-amber-300/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-4">
              Showing the first {images.length} detected images from this PDF.
            </p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 items-stretch">
            {images.map((img) => {
              const isSelected = img.id === selectedId;
              return (
                <div
                  key={img.id}
                  className={`product-card group relative h-full rounded-xl border transition-all text-left ${
                    isSelected
                      ? "z-10 border-violet-500/60 ring-1 ring-violet-500/30 bg-violet-500/8 shadow-lg shadow-violet-900/20"
                      : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.15] hover:bg-white/[0.06]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(isSelected ? null : img)}
                    aria-label={`Select PDF image from page ${img.pageNumber}`}
                    aria-pressed={isSelected}
                    className="flex flex-col flex-1 min-h-0 w-full text-left"
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center shadow-lg pointer-events-none">
                        <Check size={10} className="text-white" />
                      </div>
                    )}
                    <div className="aspect-square bg-white/[0.04] overflow-hidden flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.previewUrl}
                        alt={`PDF page ${img.pageNumber} image ${img.regionIndex}`}
                        className="w-full h-full object-contain p-1"
                      />
                    </div>
                    <div className="flex flex-col flex-1 px-2 py-1.5 pb-2 min-h-0">
                      <p className="text-[10px] text-white/40 font-mono truncate">
                        Page {img.pageNumber} · #{img.regionIndex}
                      </p>
                    </div>
                  </button>

                  <div className="product-card__footer px-2 pb-2 flex-shrink-0">
                    {isSelected && onConfirmSelection ? (
                      <button
                        type="button"
                        onClick={onConfirmSelection}
                        aria-label={`Use PDF image from page ${img.pageNumber}`}
                        className="w-full h-full flex items-center justify-between gap-2 rounded-lg border border-violet-400/45 bg-gradient-to-r from-violet-500/25 via-fuchsia-500/15 to-violet-500/20 px-2.5 py-1.5 hover:from-violet-500/35 hover:to-fuchsia-500/25 transition-colors"
                      >
                        <span className="flex items-center gap-1.5 min-w-0">
                          <Sparkles size={11} className="text-fuchsia-300/90 flex-shrink-0" />
                          <span className="text-[11px] font-semibold text-violet-100 truncate">
                            Use this image
                          </span>
                        </span>
                        <ChevronRight size={13} className="text-violet-200 flex-shrink-0" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelect(img)}
                        className="w-full h-full flex items-center justify-between text-[11px] font-semibold text-white/40 group-hover:text-violet-300 transition-colors"
                      >
                        <span>Select image</span>
                        <ChevronRight
                          size={13}
                          className="transition-transform group-hover:translate-x-0.5"
                        />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}