import { NextRequest, NextResponse } from "next/server";
import { applyFreeformEdit } from "@/lib/gemini";
import { loadProductImage } from "@/lib/product-image";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const productFile = formData.get("product") as File | null;
    const productImageUrl = (formData.get("productImageUrl") as string | null)?.trim() ?? "";
    const productName = (formData.get("productName") as string | null) ?? "souvenir product";
    const category = (formData.get("category") as string | null) ?? "merchandise";
    const description = (formData.get("description") as string | null) ?? "";
    const previousImageFile = formData.get("previousImage") as File | null;
    const priorEditsRaw = (formData.get("priorEdits") as string | null)?.trim() ?? "";
    let priorEdits: string[] = [];
    if (priorEditsRaw) {
      try {
        const parsed = JSON.parse(priorEditsRaw) as unknown;
        if (Array.isArray(parsed)) {
          priorEdits = parsed.filter((e): e is string => typeof e === "string" && e.trim().length > 0);
        }
      } catch {
        priorEdits = [];
      }
    }

    // ── Load product image (file upload or server-side URL fetch) ───────────
    let productBase64: string;
    let productMimeType: string;

    if (productImageUrl) {
      try {
        const loaded = await loadProductImage(productImageUrl);
        productBase64 = loaded.base64;
        productMimeType = loaded.mimeType;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load product image.";
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    } else if (productFile && productFile.size > 0) {
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
      const productBuffer = Buffer.from(await productFile.arrayBuffer());
      productBase64 = productBuffer.toString("base64");
      productMimeType = productFile.type;
    } else {
      return NextResponse.json(
        { error: "No product image received." },
        { status: 400 }
      );
    }

    // ── Validate description ─────────────────────────────────────────────────
    if (!description.trim()) {
      return NextResponse.json(
        { error: "Please describe what you'd like to change." },
        { status: 400 }
      );
    }

    // ── Convert previous image if provided ──────────────────────────────────
    let previousImageBase64: string | undefined;
    let previousImageMimeType: string | undefined;

    if (previousImageFile && previousImageFile.size > 0) {
      if (!ALLOWED_MIME_TYPES.includes(previousImageFile.type)) {
        return NextResponse.json(
          { error: "Invalid previous image format." },
          { status: 400 }
        );
      }
      const prevBuffer = Buffer.from(await previousImageFile.arrayBuffer());
      previousImageBase64 = prevBuffer.toString("base64");
      previousImageMimeType = previousImageFile.type;
    }

    // ── Generate modified product via Gemini ─────────────────────────────────
    const output = await applyFreeformEdit({
      productBase64,
      productMimeType,
      productName,
      category,
      description,
      previousImageBase64,
      previousImageMimeType,
      priorEdits,
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
