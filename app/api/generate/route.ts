import { NextRequest, NextResponse } from "next/server";
import { applyDesignToProduct } from "@/lib/gemini";
import { validateProductImage } from "@/lib/validateProduct";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const productFile = formData.get("product") as File | null;
    const designFile  = formData.get("design")  as File | null;
    const placementHint = (formData.get("placement") as string | null) ?? "";

    // ── Validate product file ────────────────────────────────────────────────
    if (!productFile || productFile.size === 0) {
      return NextResponse.json(
        { error: "Please upload a product image." },
        { status: 400 }
      );
    }
    if (!ALLOWED_MIME_TYPES.includes(productFile.type)) {
      return NextResponse.json(
        { error: `Unsupported product image format: ${productFile.type}. Use PNG, JPG, or WEBP.` },
        { status: 400 }
      );
    }
    if (productFile.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "Product image exceeds the 10 MB limit." },
        { status: 400 }
      );
    }

    const productBuffer  = Buffer.from(await productFile.arrayBuffer());
    const productBase64  = productBuffer.toString("base64");
    const productMimeType = productFile.type;

    // ── AI validation: is this a merchandise product? ────────────────────────
    const validation = await validateProductImage(productBase64, productMimeType);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: `The uploaded image doesn't appear to be a merchandise product.${
            validation.reason ? ` (${validation.reason})` : ""
          } Please upload a photo of a T-shirt, mug, hat, bag, or similar product.`,
          invalidProduct: true,
        },
        { status: 422 }
      );
    }

    // ── Validate design file ─────────────────────────────────────────────────
    if (!designFile || designFile.size === 0) {
      return NextResponse.json(
        { error: "Please provide a design image." },
        { status: 400 }
      );
    }
    if (!ALLOWED_MIME_TYPES.includes(designFile.type)) {
      return NextResponse.json(
        { error: `Unsupported design image format: ${designFile.type}. Use PNG, JPG, or WEBP.` },
        { status: 400 }
      );
    }
    if (designFile.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "Design image exceeds the 10 MB limit." },
        { status: 400 }
      );
    }

    const designBuffer  = Buffer.from(await designFile.arrayBuffer());
    const designBase64  = designBuffer.toString("base64");
    const designMimeType = designFile.type;

    // ── Generate mockup via Gemini ───────────────────────────────────────────
    const output = await applyDesignToProduct({
      productBase64,
      productMimeType,
      designBase64,
      designMimeType,
      placementHint,
    });

    return NextResponse.json({
      imageBase64: output.imageBase64,
      mimeType: output.mimeType,
      modelUsed: output.modelUsed,
    });
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : "Unexpected error.";
    console.error("[/api/generate] Error:", raw);

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
