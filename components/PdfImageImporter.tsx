"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  FileText,
  Loader2,
  AlertCircle,
  Check,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Library,
  Search,
} from "lucide-react";
import {
  extractImagesFromPdf,
  extractImagesFromPdfBlob,
  revokeExtractedImages,
  type ExtractedPdfImage,
} from "@/lib/pdf-extract-images";
import type { PdfDocument } from "@/lib/pdf-library-types";
import { PDF_ANALYZE_BATCH_SIZE, PDF_ANALYZE_PARALLEL } from "@/lib/pdf-library-types";
import { uploadPdfViaSignedUrl } from "@/lib/pdf-library-client-upload";
import { logUiError } from "@/lib/client-log";
import PdfLibraryBrowser from "@/components/PdfLibraryBrowser";

interface PdfLibraryDocumentRef {
  id: string;
  title: string;
}

interface Props {
  selectedId: string | null;
  onSelect: (image: ExtractedPdfImage | null) => void;
  onConfirmSelection?: () => void;
  /** Restores the image grid after remount (e.g. returning from edit step). */
  resumeLibraryDocument?: PdfLibraryDocumentRef | null;
  onResumeLibraryDocumentChange?: (doc: PdfLibraryDocumentRef | null) => void;
}

type ImportTab = "library" | "upload";

type ProcessingPhase = "idle" | "loading" | "extracting" | "preparing" | "analyzing";

const PROCESSING_MESSAGES: Record<Exclude<ProcessingPhase, "idle">, string[]> = {
  loading: ["Loading catalogue…", "Fetching your PDF…"],
  extracting: ["Reading your PDF…", "Extracting images…", "This may take a moment…"],
  preparing: ["Preparing images…"],
  analyzing: [
    "AI is analyzing products — this may take a while",
    "Still working — thanks for your patience",
  ],
};

const MESSAGE_ROTATE_MS = 4500;

interface ApiImageRecord {
  id: string;
  pageNumber: number;
  imageIndex: number;
  width: number;
  height: number;
  productType: string | null;
  labels: string[];
  description: string | null;
  isMerchandise: boolean;
  previewUrl: string;
}

const IMAGE_PAGE_SIZE = 24;
const SEARCH_DEBOUNCE_MS = 300;
const LABEL_IMAGE_MAX_PX = 512;

function duplicatePdfMessage(fileName: string): string {
  return `"${fileName}" is already in the library. Select it from the Library tab instead of uploading again.`;
}

async function removeBackgroundFile(file: File): Promise<{ file: File; previewUrl: string }> {
  const fd = new FormData();
  fd.append("image", file, file.name);

  const res = await fetch("/api/remove-background", { method: "POST", body: fd });
  const data = (await res.json()) as { imageBase64?: string; mimeType?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Failed to remove background.");
  if (!data.imageBase64) throw new Error("No image returned from background removal.");

  const mimeType = data.mimeType ?? "image/png";
  const bin = atob(data.imageBase64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });

  const fileName = file.name.replace(/\.(png|jpe?g|webp|gif)$/i, ".png");
  const nextFile = new File([blob], fileName, { type: mimeType });
  const previewUrl = URL.createObjectURL(blob);
  return { file: nextFile, previewUrl };
}

async function resizeForLabeling(file: File): Promise<File> {
  if (file.size === 0) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const maxDim = Math.max(bitmap.width, bitmap.height);
    if (maxDim <= LABEL_IMAGE_MAX_PX) {
      bitmap.close();
      return file;
    }
    const scale = LABEL_IMAGE_MAX_PX / maxDim;
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82)
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.png$/i, ".jpg"), {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const i = nextIndex++;
        await fn(items[i]!, i);
      }
    }
  );
  await Promise.all(workers);
}

async function fetchImageAsFile(url: string, name: string): Promise<File> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load image file.");
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type || "image/png" });
}

function apiRecordToExtracted(
  docId: string,
  record: ApiImageRecord
): ExtractedPdfImage {
  const previewUrl = record.previewUrl.startsWith("/")
    ? record.previewUrl
    : `/${record.previewUrl}`;

  return {
    id: `lib-${record.id}`,
    libraryImageId: record.id,
    file: new File([], `pdf-p${record.pageNumber}-img${record.imageIndex}.png`, {
      type: "image/png",
    }),
    previewUrl,
    width: record.width,
    height: record.height,
    pageNumber: record.pageNumber,
    regionIndex: record.imageIndex,
    productType: record.productType,
    labels: record.labels,
    description: record.description,
    isMerchandise: record.isMerchandise,
  };
}

export default function PdfImageImporter({
  selectedId,
  onSelect,
  onConfirmSelection,
  resumeLibraryDocument,
  onResumeLibraryDocumentChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const extractedRef = useRef<ExtractedPdfImage[]>([]);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeAttemptedRef = useRef(false);

  const [importTab, setImportTab] = useState<ImportTab>("library");
  const [dragging, setDragging] = useState(false);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [processingPhase, setProcessingPhase] = useState<ProcessingPhase>("idle");
  const [processingMessageIndex, setProcessingMessageIndex] = useState(0);
  const [processingPercent, setProcessingPercent] = useState(0);
  const [loadingLibraryId, setLoadingLibraryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<ExtractedPdfImage[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [usedRegionFallback, setUsedRegionFallback] = useState(false);
  const [pagesProcessed, setPagesProcessed] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [imagePage, setImagePage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  const displayImages = images.filter((img) => img.isMerchandise !== false);
  const totalImagePages = Math.max(1, Math.ceil(displayImages.length / IMAGE_PAGE_SIZE));
  const pagedImages = displayImages.slice(
    (imagePage - 1) * IMAGE_PAGE_SIZE,
    imagePage * IMAGE_PAGE_SIZE
  );

  const busy = processingPhase !== "idle";

  const processingMessage =
    processingPhase === "idle"
      ? null
      : PROCESSING_MESSAGES[processingPhase][
          processingMessageIndex % PROCESSING_MESSAGES[processingPhase].length
        ];

  useEffect(() => {
    if (processingPhase === "idle") {
      setProcessingMessageIndex(0);
      setProcessingPercent(0);
      return;
    }
    setProcessingMessageIndex(0);
    const timer = setInterval(() => {
      setProcessingMessageIndex((i) => i + 1);
    }, MESSAGE_ROTATE_MS);
    return () => clearInterval(timer);
  }, [processingPhase]);

  const finishProcessing = useCallback(() => {
    setProcessingPercent(100);
    setProcessingPhase("idle");
  }, []);

  useEffect(() => {
    if (!usedRegionFallback) return;
    console.warn(
      "[pdf] No embedded images were found — used page-region detection instead. Results may include catalogue text near products."
    );
  }, [usedRegionFallback]);

  const clearExtracted = useCallback(() => {
    revokeExtractedImages(extractedRef.current.filter((img) => !img.libraryImageId));
    extractedRef.current = [];
    setImages([]);
    setTruncated(false);
    setUsedRegionFallback(false);
    setPagesProcessed(0);
    setTotalPages(0);
    setImagePage(1);
    setDocumentId(null);
    setFromCache(false);
    setSearchQuery("");
    onSelect(null);
    onResumeLibraryDocumentChange?.(null);
  }, [onSelect, onResumeLibraryDocumentChange]);

  useEffect(() => {
    return () => {
      revokeExtractedImages(extractedRef.current.filter((img) => !img.libraryImageId));
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const applyImages = useCallback((next: ExtractedPdfImage[]) => {
    extractedRef.current = next;
    setImages(next);
    setImagePage(1);
  }, []);

  const cleanExtractedImages = useCallback(
    async (next: ExtractedPdfImage[]) => {
      if (next.length === 0) return next;

      setProcessingPhase("preparing");

      const cleaned = [...next];
      const total = next.length;
      let done = 0;

      await runWithConcurrency(cleaned, 3, async (img, index) => {
        // Only for extracted/local images (they have a real File and typically a blob: preview).
        if (!img.file || img.file.size === 0) {
          done++;
          setProcessingPercent(45 + Math.round((done / total) * 20));
          return;
        }

        try {
          const result = await removeBackgroundFile(img.file);

          // Revoke old object URL previews (avoid memory leaks).
          if (img.previewUrl?.startsWith("blob:")) {
            URL.revokeObjectURL(img.previewUrl);
          }

          cleaned[index] = { ...img, file: result.file, previewUrl: result.previewUrl };
        } catch (e) {
          // Keep original image if background removal fails for this one.
          logUiError("pdf.bg_remove_failed", e, { imageId: img.id });
        } finally {
          done++;
          setProcessingPercent(45 + Math.round((done / total) * 20));
        }
      });

      return cleaned;
    },
    []
  );

  const savePdfToLibrary = useCallback(async (file: File, pageCount: number) => {
    const title = file.name.replace(/\.pdf$/i, "") || file.name;

    const registerRes = await fetch("/api/pdf-library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        fileName: file.name,
        fileSize: file.size,
        pageCount: pageCount > 0 ? pageCount : null,
      }),
    });

    if (registerRes.status === 503) return null;

    if (registerRes.status === 409) {
      const data = (await registerRes.json()) as { error?: string };
      throw new Error(data.error ?? duplicatePdfMessage(file.name));
    }

    if (!registerRes.ok) {
      const data = (await registerRes.json()) as { error?: string };
      throw new Error(data.error ?? "Failed to register PDF upload.");
    }

    const data = (await registerRes.json()) as {
      document: { id: string };
      signedUrl: string;
      token: string;
      storagePath: string;
    };

    try {
      await uploadPdfViaSignedUrl(
        data.signedUrl,
        data.token,
        data.storagePath,
        file
      );
    } catch (uploadError) {
      await fetch(`/api/pdf-library/${data.document.id}`, { method: "DELETE" }).catch(
        () => undefined
      );
      throw uploadError;
    }

    return data.document.id;
  }, []);

  const analyzeAndPersist = useCallback(
    async (docId: string, extracted: ExtractedPdfImage[]) => {
      if (extracted.length === 0) return;

      const batches: ExtractedPdfImage[][] = [];
      for (let i = 0; i < extracted.length; i += PDF_ANALYZE_BATCH_SIZE) {
        batches.push(extracted.slice(i, i + PDF_ANALYZE_BATCH_SIZE));
      }

      setProcessingPhase("analyzing");
      setProcessingPercent(65);

      let completedBatches = 0;

      const sendBatch = async (batchIndex: number, batch: ExtractedPdfImage[]) => {
        const resized = await Promise.all(batch.map((img) => resizeForLabeling(img.file)));

        const form = new FormData();
        form.append("batchIndex", String(batchIndex));
        form.append("totalBatches", String(batches.length));

        batch.forEach((img, i) => {
          form.append(`image_${i}`, resized[i]!);
          form.append(`pageNumber_${i}`, String(img.pageNumber));
          form.append(`imageIndex_${i}`, String(img.regionIndex));
          form.append(`width_${i}`, String(img.width));
          form.append(`height_${i}`, String(img.height));
        });

        const res = await fetch(`/api/pdf-library/${docId}/analyze`, {
          method: "POST",
          body: form,
        });

        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? "Failed to analyze images.");
        }

        completedBatches++;
        setProcessingPercent(65 + Math.round((completedBatches / batches.length) * 30));
      };

      try {
        // Batch 0 clears old data — must run alone first.
        await sendBatch(0, batches[0]!);

        const remaining = batches.slice(1).map((batch, i) => ({
          batchIndex: i + 1,
          batch,
        }));

        await runWithConcurrency(remaining, PDF_ANALYZE_PARALLEL, async ({ batchIndex, batch }) => {
          await sendBatch(batchIndex, batch);
        });

        const finalizeRes = await fetch(`/api/pdf-library/${docId}/analyze/complete`, {
          method: "POST",
        });
        if (!finalizeRes.ok) {
          const data = (await finalizeRes.json()) as { error?: string };
          throw new Error(data.error ?? "Failed to finalize analysis.");
        }

        const finalizeData = (await finalizeRes.json()) as { images: ApiImageRecord[] };
        const cached = finalizeData.images.map((r) => apiRecordToExtracted(docId, r));
        revokeExtractedImages(extractedRef.current.filter((img) => !img.libraryImageId));
        applyImages(cached);
        setFromCache(true);
        setProcessingPercent(98);
      } finally {
        // Caller finishes the processing UI (finishProcessing).
      }
    },
    [applyImages]
  );

  const loadCachedImages = useCallback(
    async (docId: string, title: string, query?: string) => {
      const url = query
        ? `/api/pdf-library/${docId}/images?q=${encodeURIComponent(query)}`
        : `/api/pdf-library/${docId}/images`;

      const res = await fetch(url, { cache: "no-store" });
      if (res.status === 503) return false;
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to load cached images.");
      }

      const data = (await res.json()) as {
        images: ApiImageRecord[];
        document: { analysisStatus: string };
        total: number;
      };

      if (data.document.analysisStatus !== "complete" || data.total === 0) {
        return false;
      }

      const cached = data.images.map((r) => apiRecordToExtracted(docId, r));
      applyImages(cached);
      setPdfName(title);
      setDocumentId(docId);
      setFromCache(true);
      onResumeLibraryDocumentChange?.({ id: docId, title });
      return true;
    },
    [applyImages, onResumeLibraryDocumentChange]
  );

  // Restore image grid when remounting after "Change product" (component unmounts on edit step).
  useEffect(() => {
    if (resumeAttemptedRef.current || !resumeLibraryDocument || pdfName) return;
    resumeAttemptedRef.current = true;

    void (async () => {
      setDocumentId(resumeLibraryDocument.id);
      setPdfName(resumeLibraryDocument.title);
      setImportTab("library");
      setLoadingLibraryId(resumeLibraryDocument.id);
      setProcessingPhase("loading");
      setProcessingPercent(8);

      try {
        await loadCachedImages(resumeLibraryDocument.id, resumeLibraryDocument.title);
      } catch (e) {
        logUiError("pdf.resume_library_failed", e, {
          documentId: resumeLibraryDocument.id,
        });
      } finally {
        setLoadingLibraryId(null);
        finishProcessing();
      }
    })();
  }, [resumeLibraryDocument, pdfName, loadCachedImages, finishProcessing]);

  const runSearch = useCallback(
    (query: string) => {
      if (!documentId) return;

      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

      searchTimerRef.current = setTimeout(() => {
        void (async () => {
          setSearching(true);
          try {
            await loadCachedImages(documentId, pdfName ?? "", query || undefined);
          } catch (e) {
            logUiError("pdf.search_failed", e, { documentId, query });
          } finally {
            setSearching(false);
          }
        })();
      }, SEARCH_DEBOUNCE_MS);
    },
    [documentId, loadCachedImages, pdfName]
  );

  useEffect(() => {
    if (!documentId || !fromCache) return;
    runSearch(searchQuery);
  }, [searchQuery, documentId, fromCache, runSearch]);

  const runExtractionFromFile = useCallback(
    async (file: File, saveToLibrary: boolean) => {
      clearExtracted();
      setError(null);
      setPdfName(file.name);
      setProcessingPhase("extracting");
      setProcessingPercent(15);

      try {
        const result = await extractImagesFromPdf(file, ({ pageNum, pageCount }) => {
          if (pageCount > 0) {
            setProcessingPercent(15 + Math.round((pageNum / pageCount) * 30));
          }
        });

        // Option B: deterministically remove background for every extracted image (no AI).
        const cleaned = await cleanExtractedImages(result.images);
        applyImages(cleaned);
        setTruncated(result.truncated);
        setUsedRegionFallback(result.usedRegionFallback);
        setPagesProcessed(result.pagesProcessed);
        setTotalPages(result.totalPages);

        let docId: string | null = null;
        if (saveToLibrary) {
          try {
            docId = await savePdfToLibrary(file, result.totalPages);
            if (docId) {
              setDocumentId(docId);
              const title = file.name.replace(/\.pdf$/i, "") || file.name;
              onResumeLibraryDocumentChange?.({ id: docId, title });
              const cached = await loadCachedImages(docId, title);
              if (!cached) {
                await analyzeAndPersist(docId, result.images);
              }
            }
          } catch (saveError) {
            const message =
              saveError instanceof Error
                ? saveError.message
                : "Failed to save PDF to the library.";
            if (message.toLowerCase().includes("already in the library")) {
              clearExtracted();
              setPdfName(null);
              setImportTab("library");
              setError(message);
            } else {
              setError(message);
              logUiError("pdf.library_save_failed", saveError, {
                fileName: file.name,
                fileSize: file.size,
              });
            }
          }
        }
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message : "Failed to extract images from PDF.";
        setError(message);
        setPdfName(null);
        logUiError("pdf.import_failed", e, {
          fileName: file.name,
          fileSize: file.size,
        });
      } finally {
        finishProcessing();
      }
    },
    [applyImages, analyzeAndPersist, clearExtracted, savePdfToLibrary, cleanExtractedImages, onResumeLibraryDocumentChange, loadCachedImages, finishProcessing]
  );

  const handleLibraryDocument = useCallback(
    async (doc: PdfDocument) => {
      clearExtracted();
      setError(null);
      setPdfName(doc.title);
      setDocumentId(doc.id);
      onResumeLibraryDocumentChange?.({ id: doc.id, title: doc.title });
      setLoadingLibraryId(doc.id);
      setProcessingPhase("loading");
      setProcessingPercent(8);

      try {
        const cached = await loadCachedImages(doc.id, doc.title);
        if (cached) return;

        setProcessingPhase("extracting");
        setProcessingPercent(15);

        const res = await fetch(`/api/pdf-library/${doc.id}/file`, {
          cache: "no-store",
        });

        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? "Failed to load PDF from library.");
        }

        const bytes = await res.arrayBuffer();
        const result = await extractImagesFromPdfBlob(bytes, doc.fileName, ({ pageNum, pageCount }) => {
          if (pageCount > 0) {
            setProcessingPercent(15 + Math.round((pageNum / pageCount) * 30));
          }
        });

        // Option B: deterministically remove background for every extracted image (no AI).
        const cleaned = await cleanExtractedImages(result.images);
        applyImages(cleaned);
        setTruncated(result.truncated);
        setUsedRegionFallback(result.usedRegionFallback);
        setPagesProcessed(result.pagesProcessed);
        setTotalPages(result.totalPages);

        await analyzeAndPersist(doc.id, result.images);
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message : "Failed to extract images from library PDF.";
        setError(message);
        setPdfName(null);
        logUiError("pdf.library_open_failed", e, { documentId: doc.id });
      } finally {
        finishProcessing();
        setLoadingLibraryId(null);
      }
    },
    [analyzeAndPersist, applyImages, clearExtracted, loadCachedImages, cleanExtractedImages, onResumeLibraryDocumentChange, finishProcessing]
  );

  const processPdf = useCallback(
    async (file: File) => {
      try {
        const lookupRes = await fetch(
          `/api/pdf-library?fileName=${encodeURIComponent(file.name)}`,
          { cache: "no-store" }
        );

        if (lookupRes.ok) {
          setImportTab("library");
          setError(duplicatePdfMessage(file.name));
          return;
        }
      } catch (e) {
        logUiError("pdf.duplicate_lookup_failed", e, { fileName: file.name });
      }

      await runExtractionFromFile(file, true);
    },
    [runExtractionFromFile]
  );

  const handleSelectImage = useCallback(
    async (img: ExtractedPdfImage | null) => {
      if (!img) {
        onSelect(null);
        return;
      }

      if (img.libraryImageId && documentId && img.file.size === 0) {
        try {
          const file = await fetchImageAsFile(
            `/api/pdf-library/${documentId}/images/${img.libraryImageId}/file`,
            `pdf-p${img.pageNumber}-img${img.regionIndex}.png`
          );
          const withFile: ExtractedPdfImage = { ...img, file };
          onSelect(withFile);
          return;
        } catch (e) {
          logUiError("pdf.image_file_load_failed", e, { imageId: img.libraryImageId });
        }
      }

      onSelect(img);
    },
    [documentId, onSelect]
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

  const handleBackToPdfPicker = useCallback(
    (targetTab: ImportTab) => {
      clearExtracted();
      setPdfName(null);
      setError(null);
      setImportTab(targetTab);
      resumeAttemptedRef.current = false;
    },
    [clearExtracted]
  );

  const handleReplacePdf = () => {
    handleBackToPdfPicker(documentId && fromCache ? "library" : "upload");
  };

  const handleImportTabChange = (tab: ImportTab) => {
    if (pdfName) {
      handleBackToPdfPicker(tab);
      return;
    }
    setImportTab(tab);
  };

  const showUploadDropzone = importTab === "upload" && !pdfName && !busy;
  const showLibrary = importTab === "library" && !pdfName && !busy;
  const libraryTabActive = importTab === "library" && (!pdfName || fromCache);
  const uploadTabActive = importTab === "upload" && (!pdfName || !fromCache);

  return (
    <div>
      {!busy && (
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.08] mb-4">
          <button
            type="button"
            onClick={() => handleImportTabChange("library")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition-all ${
              libraryTabActive
                ? "bg-violet-600/80 text-white"
                : "text-white/50 hover:text-white/75"
            }`}
          >
            <Library size={14} />
            Library
          </button>
          <button
            type="button"
            onClick={() => handleImportTabChange("upload")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition-all ${
              uploadTabActive
                ? "bg-violet-600/80 text-white"
                : "text-white/50 hover:text-white/75"
            }`}
          >
            <Upload size={14} />
            Upload new
          </button>
        </div>
      )}

      {showLibrary && (
        <PdfLibraryBrowser
          onSelectDocument={(doc) => void handleLibraryDocument(doc)}
          loadingDocumentId={loadingLibraryId}
        />
      )}

      {showUploadDropzone && (
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
          <p className="text-[11px] text-white/40">
            PDF · max 25 MB · AI labels images for search · saved to shared library
          </p>
        </div>
      )}

      {busy && (
        <div className="flex items-center justify-center py-14 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.10] bg-white/[0.04] px-6 py-8 flex flex-col items-center gap-5 shadow-lg shadow-black/20">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-violet-500/10 border border-violet-500/20">
              <Loader2 size={26} className="text-violet-400 animate-spin" />
            </div>
            <div className="w-full space-y-3 text-center">
              <p className="text-sm font-medium text-white/85 leading-snug px-1">
                {processingMessage ?? "Working on your PDF…"}
              </p>
              <div className="w-full h-2 rounded-full bg-white/[0.08] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, processingPercent))}%` }}
                />
              </div>
              <p className="text-xs font-medium text-violet-300/90 tabular-nums">
                {processingPercent}%
              </p>
            </div>
          </div>
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

      {pdfName && !busy && images.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <FileText size={14} className="text-violet-400 flex-shrink-0" />
              <span className="text-[12px] text-white/60 truncate" title={pdfName}>
                {pdfName}
              </span>
              <span className="text-[11px] text-white/35 flex-shrink-0">
                · {displayImages.length} image{displayImages.length !== 1 ? "s" : ""}
                {fromCache ? " · indexed" : ""}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleBackToPdfPicker(fromCache ? "library" : "upload")}
              className="text-[11px] text-violet-300/80 hover:text-violet-200 transition-colors"
            >
              {fromCache ? "Choose another PDF" : "Upload a different PDF"}
            </button>
          </div>

          {documentId && fromCache && (
            <div className="relative mb-4">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder='Search products (e.g. "hat", "mug")…'
                className="w-full rounded-xl border border-white/[0.10] bg-white/[0.04] pl-9 pr-3 py-2.5 text-sm text-white/85 placeholder:text-white/30 focus:outline-none focus:border-violet-500/40"
              />
              {searching && (
                <Loader2
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-violet-400 animate-spin"
                />
              )}
            </div>
          )}

          {truncated && (
            <p className="text-[11px] text-amber-300/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-4">
              This PDF has {totalPages} pages. Only the first {pagesProcessed} pages were
              processed (100-page safety limit).
            </p>
          )}

          {!truncated && totalPages > 0 && !fromCache && (
            <p className="text-[11px] text-emerald-300/70 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 mb-4">
              Processed all {pagesProcessed} page{pagesProcessed !== 1 ? "s" : ""} ·{" "}
              {images.length} image{images.length !== 1 ? "s" : ""} extracted
            </p>
          )}

          {displayImages.length === 0 ? (
            <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="text-amber-300 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-amber-200/90 leading-relaxed">
                  {searchQuery
                    ? `No matches for "${searchQuery}". Try another term or clear the search.`
                    : "No merchandise images were found in this PDF."}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 items-stretch">
                {pagedImages.map((img) => {
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
                        onClick={() =>
                          void handleSelectImage(isSelected ? null : img)
                        }
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
                        <div className="flex flex-col flex-1 px-2 py-1.5 pb-2 min-h-0 gap-1">
                          <p className="text-[10px] text-white/40 font-mono truncate">
                            Page {img.pageNumber} · #{img.regionIndex}
                          </p>
                          {img.productType && (
                            <p className="text-[10px] font-semibold text-violet-300/90 truncate capitalize">
                              {img.productType}
                            </p>
                          )}
                          {img.labels && img.labels.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {img.labels.slice(0, 3).map((label) => (
                                <span
                                  key={label}
                                  className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/45"
                                >
                                  {label}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </button>

                      <div className="product-card__footer px-2 pb-2 flex-shrink-0">
                        {isSelected && onConfirmSelection ? (
                          <button
                            type="button"
                            onClick={async () => {
                              await handleSelectImage(img);
                              onConfirmSelection?.();
                            }}
                            aria-label={`Use PDF image from page ${img.pageNumber}`}
                            className="w-full h-full flex items-center justify-between gap-2 rounded-lg border border-violet-400/45 bg-gradient-to-r from-violet-500/25 via-fuchsia-500/15 to-violet-500/20 px-2.5 py-1.5 hover:from-violet-500/35 hover:to-fuchsia-500/25 transition-colors"
                          >
                            <span className="flex items-center gap-1.5 min-w-0">
                              <Sparkles
                                size={11}
                                className="text-fuchsia-300/90 flex-shrink-0"
                              />
                              <span className="text-[11px] font-semibold text-violet-100 truncate">
                                Use this image
                              </span>
                            </span>
                            <ChevronRight size={13} className="text-violet-200 flex-shrink-0" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleSelectImage(img)}
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

              {totalImagePages > 1 && (
                <div className="flex items-center justify-between gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setImagePage((p) => Math.max(1, p - 1))}
                    disabled={imagePage <= 1}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-white/[0.10] bg-white/[0.04] text-[12px] font-semibold text-white/60 hover:text-white/90 hover:border-violet-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={14} />
                    Previous
                  </button>
                  <span className="text-[11px] text-white/40">
                    Page {imagePage} of {totalImagePages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setImagePage((p) => Math.min(totalImagePages, p + 1))}
                    disabled={imagePage >= totalImagePages}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-white/[0.10] bg-white/[0.04] text-[12px] font-semibold text-white/60 hover:text-white/90 hover:border-violet-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
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
