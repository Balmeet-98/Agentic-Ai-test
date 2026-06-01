"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  ArrowLeft,
  Check,
  Sparkles,
  AlertCircle,
  Loader2,
} from "lucide-react";
import type { InventoryItem } from "@/lib/inventory-types";

export interface EditMessage {
  role: "user" | "assistant";
  text: string;
  mockupDataUrl?: string;
  isError?: boolean;
}

interface Props {
  product: InventoryItem;
  currentMockup: { dataUrl: string; base64: string; mimeType: string } | null;
  isLoading: boolean;
  onSubmitEdit: (description: string) => Promise<{ dataUrl: string }>;
  onBack: () => void;
  onDone: () => void;
}

function assistantBubbleClass(msg: EditMessage) {
  if (msg.isError) {
    return "bg-red-500/10 text-red-200 border border-red-500/30 rounded-bl-md";
  }
  return "bg-white/[0.08] text-white border border-white/[0.14] rounded-bl-md";
}

export default function EditRequestChat({
  product,
  currentMockup,
  isLoading,
  onSubmitEdit,
  onBack,
  onDone,
}: Props) {
  const [messages, setMessages] = useState<EditMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, currentMockup]);

  const previewSrc = currentMockup?.dataUrl ?? product.imageUrl;
  const hasEditedMockup = Boolean(currentMockup);

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: EditMessage = { role: "user", text: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    const description = input.trim();
    setInput("");
    setError(null);

    try {
      const { dataUrl } = await onSubmitEdit(description);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Mockup updated. Request more changes or tap Done when you're happy.",
          mockupDataUrl: dataUrl,
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate mockup";
      setError(message);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `Something went wrong: ${message}`, isError: true },
      ]);
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-5 min-h-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 sm:w-12 sm:h-12 flex-shrink-0 rounded-xl overflow-hidden border border-white/[0.12] bg-white shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.imageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-white/95 text-sm sm:text-base leading-tight">
              Edit product
            </p>
            <p className="text-[11px] sm:text-[12px] text-white/45 truncate mt-0.5">
              {product.name}
            </p>
            <p className="text-[10px] text-white/30 font-mono truncate">{product.sku}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onBack}
          disabled={isLoading}
          className="self-start sm:self-center flex items-center gap-1.5 text-[12px] text-white/50 hover:text-white/80 border border-white/[0.10] hover:border-white/[0.18] rounded-lg px-3 py-2 transition-colors disabled:opacity-40"
        >
          <ArrowLeft size={14} />
          Change product
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/25 rounded-xl px-3.5 py-3 flex-shrink-0">
          <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-[12px] text-red-300 leading-relaxed">{error}</p>
        </div>
      )}

      <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-5 lg:items-stretch gap-4">
        {/* Current design preview */}
        <section
          className="order-1 lg:order-2 rounded-2xl border border-white/[0.10] bg-white/[0.03] overflow-hidden flex flex-col h-[min(65vh,480px)] sm:h-[min(70vh,520px)] lg:h-[560px]"
          aria-label="Current design"
        >
          <div className="flex-shrink-0 px-3 sm:px-4 py-3 border-b border-white/[0.08] bg-white/[0.02] min-h-[2.75rem] flex items-center justify-between gap-2">
            <p className="text-[11px] text-white/55 uppercase tracking-wider font-semibold">
              Current design
            </p>
            {hasEditedMockup && !isLoading && (
              <span className="text-[10px] font-medium text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2 py-0.5">
                Updated
              </span>
            )}
          </div>

          <div className="relative flex-1 min-h-0 bg-[#ececf0] flex items-center justify-center p-3 sm:p-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={previewSrc}
              src={previewSrc}
              alt={hasEditedMockup ? "Current mockup" : product.name}
              className="max-w-full max-h-full w-auto h-auto object-contain drop-shadow-md"
            />
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#13111f]/60 backdrop-blur-sm">
                <Loader2 size={28} className="text-violet-300 animate-spin" />
                <p className="text-[12px] font-medium text-white/80">Generating…</p>
              </div>
            )}
          </div>

          <div className="flex-shrink-0 border-t border-white/[0.06] bg-[#13111f]/30 p-3 sm:p-4 space-y-2.5">
            <p className="text-[10px] sm:text-[11px] text-white/45 text-center">
              {hasEditedMockup
                ? "This is your latest mockup — more edits update this view"
                : "Catalogue photo — your edits will appear here"}
            </p>
            <button
              type="button"
              onClick={onDone}
              disabled={isLoading || !hasEditedMockup}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed text-[13px] shadow-lg shadow-emerald-900/20"
            >
              <Check size={16} />
              Done
            </button>
          </div>
        </section>

        {/* Describe changes */}
        <section
          className="order-2 lg:order-1 rounded-2xl border border-white/[0.10] bg-white/[0.03] overflow-hidden flex flex-col h-[min(65vh,480px)] sm:h-[min(70vh,520px)] lg:h-[560px]"
          aria-label="Edit conversation"
        >
          <div className="flex-shrink-0 px-3 sm:px-4 py-3 border-b border-white/[0.08] bg-white/[0.02] min-h-[2.75rem] flex items-center">
            <p className="text-[11px] text-white/55 uppercase tracking-wider font-semibold">
              Describe changes
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-3 min-h-[120px]">
            {messages.length === 0 && !isLoading && (
              <div className="rounded-xl border border-dashed border-white/[0.10] bg-white/[0.02] px-4 py-5 text-center h-full flex flex-col items-center justify-center min-h-[120px]">
                <Sparkles size={18} className="text-violet-400/60 mx-auto mb-2" />
                <p className="text-[12px] text-white/45 leading-relaxed max-w-[260px] mx-auto">
                  e.g. &ldquo;Change Halifax to Cape Breton&rdquo; or &ldquo;Make the text bolder&rdquo;
                </p>
                <p className="text-[11px] text-white/30 mt-2 max-w-[240px]">
                  Text and logos on the product only — the item itself stays the same
                </p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={`${idx}-${msg.mockupDataUrl ? "img" : "txt"}`}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[12px] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-violet-600/35 text-violet-50 border border-violet-500/25 rounded-br-md"
                      : assistantBubbleClass(msg)
                  }`}
                >
                  <p>{msg.text}</p>
                  {msg.mockupDataUrl && (
                    <div className="mt-2.5">
                      <p className="text-[10px] font-medium text-white/80 mb-1.5">
                        Edited mockup
                      </p>
                      <div className="rounded-lg overflow-hidden bg-[#ececf0] border border-white/20">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={msg.mockupDataUrl}
                          alt="Edited mockup"
                          className="w-full max-h-[240px] sm:max-h-[300px] object-contain"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-center py-1" role="status" aria-live="polite">
                <div className="inline-flex items-center gap-2 rounded-full bg-sky-500/10 border border-sky-400/20 px-3 py-1.5">
                  <Loader2 size={12} className="text-sky-300 animate-spin flex-shrink-0" />
                  <span className="text-[11px] text-sky-200/90 font-medium">
                    Generating…
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="flex-shrink-0 p-3 sm:p-4 border-t border-white/[0.08] bg-[#13111f]/40">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSubmit()}
                placeholder="Describe your changes…"
                disabled={isLoading}
                className="flex-1 min-w-0 bg-white/[0.06] border border-white/[0.12] rounded-xl px-3.5 py-3 text-[13px] sm:text-[14px] text-white placeholder-white/25 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/25 transition-all disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!input.trim() || isLoading}
                aria-label="Send edit request"
                className="flex-shrink-0 flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-all disabled:bg-violet-600/35 disabled:cursor-not-allowed shadow-lg shadow-violet-900/25"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
