"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Upload, X, Image as ImageIcon, CheckCircle2 } from "lucide-react";

interface Props {
  label: string;
  sublabel?: string;
  accept?: string;
  onFile: (file: File | null) => void;
  file: File | null;
  index?: number;
}

export default function ImageDropzone({
  label,
  sublabel,
  accept = "image/png,image/jpeg,image/webp",
  onFile,
  file,
  index,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // Create a blob URL for preview. useMemo avoids setState-in-effect; the
  // cleanup-only useEffect below revokes the stale URL when file changes.
  const objectUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file]
  );
  useEffect(() => () => { if (objectUrl) URL.revokeObjectURL(objectUrl); }, [objectUrl]);

  const hasContent = !!objectUrl;

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

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Label */}
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

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !hasContent && inputRef.current?.click()}
        className={`relative rounded-2xl border-2 transition-all duration-200 overflow-hidden select-none ${
          hasContent
            ? "border-violet-500/25 cursor-default"
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
              src={objectUrl!}
              alt="preview"
              className="w-full object-contain rounded-xl"
              style={{ maxHeight: "220px" }}
            />
            <button
              type="button"
              onClick={() => onFile(null)}
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
