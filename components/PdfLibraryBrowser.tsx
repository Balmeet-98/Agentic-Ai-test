"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, AlertCircle } from "lucide-react";
import type { PdfDocument } from "@/lib/pdf-library-types";

interface Props {
  onSelectDocument: (document: PdfDocument) => void;
  loadingDocumentId?: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function PdfLibraryBrowser({
  onSelectDocument,
  loadingDocumentId,
}: Props) {
  const [documents, setDocuments] = useState<PdfDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotConfigured(false);

    try {
      const res = await fetch("/api/pdf-library", { cache: "no-store" });
      const data = (await res.json()) as {
        documents?: PdfDocument[];
        error?: string;
      };

      if (res.status === 503) {
        setNotConfigured(true);
        setDocuments([]);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load PDF library.");
      }

      setDocuments(data.documents ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load PDF library.");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 size={22} className="text-violet-400 animate-spin" />
        <p className="text-sm text-white/50">Loading PDF library…</p>
      </div>
    );
  }

  if (notConfigured) {
    return (
      <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
        <AlertCircle size={16} className="text-amber-300 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-amber-200/90 leading-relaxed">
          Shared PDF library is not configured yet. You can still upload a new PDF
          using the Upload tab. Ask your admin to set up Supabase storage.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
        <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-red-300 leading-relaxed">{error}</p>
          <button
            type="button"
            onClick={() => void loadDocuments()}
            className="mt-2 text-[11px] text-red-300/80 hover:text-red-200 underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-10 px-4">
        <FileText size={28} className="text-white/20 mx-auto mb-3" />
        <p className="text-sm text-white/55">No PDFs in the library yet.</p>
        <p className="text-[11px] text-white/35 mt-1">
          Upload a PDF in the Upload tab — it will be saved for everyone.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => {
        const isLoading = loadingDocumentId === doc.id;
        return (
          <button
            key={doc.id}
            type="button"
            onClick={() => onSelectDocument(doc)}
            disabled={Boolean(loadingDocumentId)}
            className="w-full flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:border-violet-500/35 hover:bg-violet-500/[0.06] px-4 py-3 text-left transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="w-9 h-9 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center flex-shrink-0">
              {isLoading ? (
                <Loader2 size={16} className="text-violet-300 animate-spin" />
              ) : (
                <FileText size={16} className="text-violet-300" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white/85 truncate">{doc.title}</p>
              <p className="text-[11px] text-white/40 mt-0.5">
                {formatBytes(doc.fileSize)}
                {doc.pageCount ? ` · ${doc.pageCount} pages` : ""}
                {" · "}
                {formatDate(doc.createdAt)}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
