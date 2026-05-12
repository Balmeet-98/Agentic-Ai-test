"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, X, Image as ImageIcon, Link, CheckCircle2 } from "lucide-react";

interface Props {
  label: string;
  sublabel?: string;
  accept?: string;
  onFile: (file: File | null) => void;
  onUrl?: (url: string) => void;
  allowUrl?: boolean;
  file: File | null;
  previewSrc?: string;
  index?: number;
}

export default function ImageDropzone({
  label,
  sublabel,
  accept = "image/png,image/jpeg,image/webp",
  onFile,
  onUrl,
  allowUrl = false,
  file,
  previewSrc,
  index,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [urlMode, setUrlMode] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  // Keep track of the object URL so we can revoke it on cleanup
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  // Create / revoke object URL whenever `file` changes
  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const preview = previewSrc ?? objectUrl;
  const hasContent = !!preview;

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) onFile(dropped);
    },
    [onFile]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    onFile(picked);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleUrlSubmit = () => {
    if (urlValue.trim() && onUrl) {
      onUrl(urlValue.trim());
      setUrlMode(false);
    }
  };

  const handleClear = () => {
    onFile(null);
    onUrl?.("");
    setUrlValue("");
    setUrlMode(false);
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Label row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {index !== undefined && (
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 transition-all ${
              hasContent
                ? "bg-violet-500 text-white shadow-lg shadow-violet-500/30"
                : "bg-white/12 text-white/55 border border-white/15"
            }`}>
              {hasContent ? <CheckCircle2 size={13} /> : index}
            </div>
          )}
          <div>
            <p className="font-semibold text-sm text-white leading-tight">{label}</p>
            {sublabel && <p className="text-[11px] text-white/50 mt-0.5">{sublabel}</p>}
          </div>
        </div>

        {allowUrl && !hasContent && (
          <button
            type="button"
            onClick={() => setUrlMode((v) => !v)}
            className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border transition-all flex-shrink-0 ${
              urlMode
                ? "border-violet-500/60 bg-violet-500/15 text-violet-300"
                : "border-white/10 bg-white/4 text-white/40 hover:text-white/70 hover:border-white/20"
            }`}
          >
            <Link size={11} />
            URL
          </button>
        )}
      </div>

      {/* URL input */}
      {urlMode && !hasContent && (
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://example.com/tshirt.jpg"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
            autoFocus
            className="flex-1 min-w-0 bg-white/5 border border-white/12 rounded-xl px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-violet-500/70 focus:bg-violet-500/5 transition-all"
          />
          <button
            type="button"
            onClick={handleUrlSubmit}
            disabled={!urlValue.trim()}
            className="px-3.5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-30 text-white text-xs font-semibold rounded-xl transition-all flex-shrink-0"
          >
            Load
          </button>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !hasContent && !urlMode && inputRef.current?.click()}
        className={`relative rounded-2xl border-2 transition-all duration-200 overflow-hidden select-none ${
          hasContent
            ? "border-violet-500/25 bg-transparent cursor-default"
            : dragging
            ? "border-violet-400 bg-violet-500/12 scale-[1.01] cursor-copy shadow-lg shadow-violet-500/25"
            : "border-dashed border-white/18 bg-white/[0.04] hover:bg-white/[0.07] hover:border-white/28 cursor-pointer"
        }`}
        style={{ minHeight: hasContent ? 0 : "176px" }}
      >
        {hasContent ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview!}
              alt="preview"
              className="w-full object-contain rounded-xl"
              style={{ maxHeight: "220px" }}
            />
            <button
              type="button"
              onClick={handleClear}
              className="absolute top-2 right-2 w-7 h-7 bg-black/70 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all backdrop-blur-sm shadow-lg"
              title="Remove"
            >
              <X size={13} />
            </button>
            {file && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 py-2.5 rounded-b-xl">
                <p className="text-[11px] text-white/60 truncate">{file.name}</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-8 px-4 text-center">
            <div className={`p-3.5 rounded-2xl transition-all ${dragging ? "bg-violet-500/25 scale-110" : "bg-white/5"}`}>
              {dragging
                ? <ImageIcon size={26} className="text-violet-400" />
                : <Upload size={26} className="text-white/25" />
              }
            </div>
            <div>
              <p className="text-sm text-white/65 font-medium">
                {dragging ? "Release to upload" : "Drag & drop or click to browse"}
              </p>
              <p className="text-[11px] text-white/35 mt-1">PNG · JPG · WEBP · max 10 MB</p>
            </div>
          </div>
        )}
      </div>

      <input ref={inputRef} type="file" accept={accept} onChange={handleFileChange} className="hidden" />
    </div>
  );
}
