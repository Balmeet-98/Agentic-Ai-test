"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Wand2, Check, Loader2, Bot, User, RotateCcw } from "lucide-react";

export interface ChatMessage {
  role: "user" | "model";
  text: string;
  imageBase64?: string;
  imageMimeType?: string;
}

interface Props {
  onDesignSelect: (base64: string, mimeType: string, previewUrl: string) => void;
}

const SUGGESTIONS = [
  "A vintage mountain sunrise logo in orange and gold",
  "A minimalist wave graphic in navy blue",
  "A retro 80s neon palm tree design",
  "A bold typography logo saying 'Ocean Club'",
];

export default function DesignChat({ onDesignSelect }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    setChatError(null);

    const userMessage: ChatMessage = { role: "user", text: text.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");

    setIsLoading(true);
    try {
      const res = await fetch("/api/design-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate design");

      const modelMessage: ChatMessage = {
        role: "model",
        text: data.reply ?? "",
        imageBase64: data.imageBase64 ?? undefined,
        imageMimeType: data.mimeType ?? undefined,
      };

      setMessages((prev) => [...prev, modelMessage]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleUseDesign = (msg: ChatMessage, index: number) => {
    if (!msg.imageBase64 || !msg.imageMimeType) return;
    setSelectedIndex(index);
    const previewUrl = `data:${msg.imageMimeType};base64,${msg.imageBase64}`;
    onDesignSelect(msg.imageBase64, msg.imageMimeType, previewUrl);
  };

  const handleReset = () => {
    setMessages([]);
    setInput("");
    setSelectedIndex(null);
    setChatError(null);
    inputRef.current?.focus();
  };

  // Index of the latest model message that has an image
  const lastImageIndex = messages.reduce(
    (last, msg, i) => (msg.role === "model" && msg.imageBase64 ? i : last),
    -1
  );

  return (
    <div className="flex flex-col gap-0">
      {/* Chat history */}
      <div
        ref={scrollRef}
        className="h-[320px] overflow-y-auto flex flex-col gap-3 pr-0.5 pb-1"
      >
        {messages.length === 0 ? (
          /* Empty state with suggestions */
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-2">
            <div className="w-11 h-11 rounded-2xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
              <Wand2 size={18} className="text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white/75">Describe your design</p>
              <p className="text-xs text-white/40 mt-1">
                Tell the AI what artwork you want to create
              </p>
            </div>
            {/* Quick suggestions */}
            <div className="flex flex-col gap-1.5 w-full max-w-[280px]">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-left text-xs text-white/50 hover:text-white/80 bg-white/4 hover:bg-white/8 border border-white/8 hover:border-white/15 rounded-xl px-3 py-2 transition-all leading-relaxed"
                >
                  {'"'}{s}{'"'}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    msg.role === "user"
                      ? "bg-violet-600 text-white"
                      : "bg-white/12 text-white/55"
                  }`}
                >
                  {msg.role === "user" ? <User size={11} /> : <Bot size={11} />}
                </div>

                {/* Bubble + image */}
                <div
                  className={`flex flex-col gap-1.5 min-w-0 ${
                    msg.role === "user"
                      ? "items-end max-w-[85%]"
                      : "items-start max-w-[90%]"
                  }`}
                >
                  {msg.text && (
                    <div
                      className={`px-3 py-2 rounded-2xl text-xs leading-relaxed break-words ${
                        msg.role === "user"
                          ? "bg-violet-600/80 text-white rounded-tr-sm"
                          : "bg-white/8 text-white/80 border border-white/10 rounded-tl-sm"
                      }`}
                    >
                      {msg.text}
                    </div>
                  )}

                  {/* Generated design image */}
                  {msg.imageBase64 && msg.imageMimeType && (
                    <div className="flex flex-col gap-1.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`data:${msg.imageMimeType};base64,${msg.imageBase64}`}
                        alt="Generated design"
                        className="rounded-xl border border-white/15 shadow-lg shadow-black/30"
                        style={{ maxWidth: "200px" }}
                      />
                      {/* "Use this design" — only on the latest image */}
                      {i === lastImageIndex && (
                        <button
                          onClick={() => handleUseDesign(msg, i)}
                          className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-[11px] font-semibold transition-all ${
                            selectedIndex === i
                              ? "bg-green-500/20 text-green-400 border border-green-500/30"
                              : "bg-violet-600/80 hover:bg-violet-500 text-white border border-violet-500/40"
                          }`}
                          style={{ maxWidth: "200px" }}
                        >
                          <Check size={11} />
                          {selectedIndex === i ? "Design selected ✓" : "Use this design"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading bubble */}
            {isLoading && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-white/12 flex items-center justify-center flex-shrink-0">
                  <Bot size={11} className="text-white/55" />
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-white/8 rounded-2xl rounded-tl-sm border border-white/10">
                  <Loader2 size={12} className="text-violet-400 animate-spin" />
                  <span className="text-xs text-white/45">Designing…</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Error */}
      {chatError && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-2">
          {chatError}
        </div>
      )}

      {/* Input row */}
      <div className="flex gap-2 pt-2.5 border-t border-white/8">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage(input);
            }
          }}
          placeholder="Describe the design you want…"
          disabled={isLoading}
          className="flex-1 min-w-0 bg-white/6 border border-white/12 rounded-xl px-3 py-2.5 text-xs text-white placeholder-white/25 focus:outline-none focus:border-violet-500/60 transition-all disabled:opacity-50"
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isLoading}
          className="w-9 h-9 rounded-xl bg-violet-600 hover:bg-violet-500 text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 self-center"
          title="Send"
        >
          <Send size={14} />
        </button>
        {messages.length > 0 && (
          <button
            onClick={handleReset}
            className="w-9 h-9 rounded-xl border border-white/12 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 flex items-center justify-center transition-all flex-shrink-0 self-center"
            title="Start over"
          >
            <RotateCcw size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
