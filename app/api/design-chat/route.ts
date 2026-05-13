import { NextRequest, NextResponse } from "next/server";
import { chatGenerateDesign, ChatMessage } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages: ChatMessage[] = body.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "A non-empty messages array is required." },
        { status: 400 }
      );
    }

    // Validate each message has a role and some content
    for (const msg of messages) {
      if (msg.role !== "user" && msg.role !== "model") {
        return NextResponse.json(
          { error: `Invalid message role: "${msg.role}". Must be "user" or "model".` },
          { status: 400 }
        );
      }
    }

    const result = await chatGenerateDesign(messages);

    return NextResponse.json({
      reply: result.reply,
      imageBase64: result.imageBase64 ?? null,
      mimeType: result.mimeType ?? "image/png",
    });
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : "Unexpected error.";
    console.error("[/api/design-chat] Error:", raw);

    if (raw.includes("429") || raw.includes("Too Many Requests") || raw.includes("quota")) {
      return NextResponse.json(
        { error: "Gemini quota exceeded. Please try again later." },
        { status: 429 }
      );
    }
    if (raw.includes("API key") || raw.includes("API_KEY_INVALID")) {
      return NextResponse.json(
        { error: "Invalid Gemini API key. Check GEMINI_API_KEY in your environment." },
        { status: 401 }
      );
    }
    if (raw.includes("503") || raw.includes("UNAVAILABLE") || raw.includes("high demand")) {
      return NextResponse.json(
        { error: "Gemini is under high demand. Please wait 30–60 seconds and try again." },
        { status: 503 }
      );
    }
    if (raw.includes("thought_signature")) {
      return NextResponse.json(
        { error: "Session expired — please start a new chat and try again." },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: raw }, { status: 500 });
  }
}
