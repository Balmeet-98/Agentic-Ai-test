"use client";

import { Download, RefreshCw, Sparkles, ImageIcon } from "lucide-react";

interface Props {
  imageBase64: string | null;
  dataUrl?: string | null;
  mimeType: string;
  isLoading: boolean;
  onReset: () => void;
}

export default function ResultPanel({ imageBase64, dataUrl, mimeType, isLoading, onReset }: Props) {
  const imgSrc = dataUrl ?? (imageBase64 ? `data:${mimeType};base64,${imageBase64}` : null);

  const handleDownload = () => {
    if (!imgSrc) return;
    const ext = mimeType.split("/")[1] ?? "png";
    const a = document.createElement("a");
    a.href = imgSrc;
    a.download = `merch-mockup-${Date.now()}.${ext}`;
    a.click();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-14 px-4">
        {/* Layered pulse rings */}
        <div className="relative w-24 h-24 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-violet-500/20 animate-ping" style={{ animationDuration: "2s" }} />
          <div className="absolute inset-3 rounded-full border border-violet-400/30 animate-ping" style={{ animationDuration: "1.5s", animationDelay: "0.3s" }} />
          <div className="absolute inset-6 rounded-full bg-gradient-to-br from-violet-600/30 to-fuchsia-600/20 animate-pulse flex items-center justify-center">
            <Sparkles size={22} className="text-violet-300" />
          </div>
        </div>

        <div className="text-center space-y-1.5">
          <p className="text-white/90 font-semibold text-base">Creating your mockup…</p>
          <p className="text-white/55 text-sm">Gemini AI is applying your design to the product</p>
        </div>

        {/* Shimmer bar */}
        <div className="w-52 h-[3px] bg-white/8 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-500 rounded-full animate-shimmer" />
        </div>

        <p className="text-[11px] text-white/35 tracking-wider uppercase">This may take 10–20 seconds</p>
      </div>
    );
  }

  if (!imgSrc) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-14 px-4 text-center">
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 border border-white/15 flex items-center justify-center animate-float">
            <ImageIcon size={32} className="text-white/30" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
            <Sparkles size={11} className="text-violet-400/60" />
          </div>
        </div>
        <div>
          <p className="text-white/70 font-semibold">Your mockup appears here</p>
          <p className="text-white/40 text-sm mt-1.5 leading-relaxed max-w-[220px] mx-auto">
            Upload a product &amp; design, then hit <span className="text-white/60 font-medium">Generate Mockup</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Image */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-white/3 to-white/1 border border-white/10 shadow-2xl shadow-black/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt="Generated product mockup"
          className="w-full object-contain"
          style={{ maxHeight: "400px" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* Actions */}
      <div className="flex gap-2.5">
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-violet-900/30 hover:shadow-violet-900/50 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] text-sm"
        >
          <Download size={16} />
          Download
        </button>
        <button
          onClick={onReset}
          title="Start over"
          className="w-11 h-11 rounded-xl border border-white/15 bg-white/7 hover:bg-white/12 hover:border-white/25 text-white/60 hover:text-white flex items-center justify-center transition-all active:scale-95"
        >
          <RefreshCw size={15} />
        </button>
      </div>
    </div>
  );
}
