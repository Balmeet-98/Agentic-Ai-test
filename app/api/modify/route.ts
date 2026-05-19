import { NextRequest, NextResponse } from "next/server";
import { applyTextChangesToProduct } from "@/lib/gemini";
import type { TextChange } from "@/lib/gemini";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const productFile = formData.get("product") as File | null;
    const productName = (formData.get("productName") as string | null) ?? "souvenir product";
    const category = (formData.get("category") as string | null) ?? "merchandise";
    const changesJson = (formData.get("changes") as string | null) ?? "[]";

    // ── Validate product file ────────────────────────────────────────────────
    if (!productFile || productFile.size === 0) {
      return NextResponse.json(
        { error: "No product image received." },
        { status: 400 }
      );
    }
    if (!ALLOWED_MIME_TYPES.includes(productFile.type)) {
      return NextResponse.json(
        { error: `Unsupported image format: ${productFile.type}. Use PNG, JPG, or WEBP.` },
        { status: 400 }
      );
    }
    if (productFile.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "Product image exceeds the 10 MB limit." },
        { status: 400 }
      );
    }

    // ── Parse changes ────────────────────────────────────────────────────────
    let changes: TextChange[];
    try {
      changes = JSON.parse(changesJson);
      if (!Array.isArray(changes) || changes.length === 0) {
        return NextResponse.json(
          { error: "At least one text change is required." },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid changes payload." },
        { status: 400 }
      );
    }

    // ── Convert product to base64 ────────────────────────────────────────────
    const productBuffer = Buffer.from(await productFile.arrayBuffer());
    const productBase64 = productBuffer.toString("base64");
    const productMimeType = productFile.type;

    // ── Generate modified product via Gemini ─────────────────────────────────
    const output = await applyTextChangesToProduct({
      productBase64,
      productMimeType,
      productName,
      category,
      changes,
    });

    return NextResponse.json({
      imageBase64: output.imageBase64,
      mimeType: output.mimeType,
      modelUsed: output.modelUsed,
    });
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : "Unexpected error.";
    console.error("[/api/modify] Error:", raw);

    if (raw.includes("429") || raw.includes("Too Many Requests") || raw.includes("quota")) {
      return NextResponse.json(
        { error: "Gemini quota exceeded. Please check your billing and try again." },
        { status: 429 }
      );
    }
    if (raw.includes("404") || raw.includes("not found for API version")) {
      return NextResponse.json(
        { error: "Gemini model not found. The model name may be outdated." },
        { status: 404 }
      );
    }
    if (raw.includes("API key") || raw.includes("API_KEY_INVALID")) {
      return NextResponse.json(
        { error: "Invalid Gemini API key. Check GEMINI_API_KEY in .env.local." },
        { status: 401 }
      );
    }

    return NextResponse.json({ error: raw }, { status: 500 });
  }
}
