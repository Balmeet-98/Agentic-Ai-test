import { NextRequest, NextResponse } from "next/server";
import { applyDesignToTshirt } from "@/lib/gemini";
import { validateTshirtImage } from "@/lib/validateTshirt";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const tshirtFile = formData.get("tshirt") as File | null;
    const designFile = formData.get("design") as File | null;
    const placementHint = (formData.get("placement") as string | null) ?? "";

    // ── Validate T-shirt file ────────────────────────────────────────────────
    if (!tshirtFile || tshirtFile.size === 0) {
      return NextResponse.json({ error: "Please upload a T-shirt image." }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.includes(tshirtFile.type)) {
      return NextResponse.json({ error: `Unsupported T-shirt image type: ${tshirtFile.type}` }, { status: 400 });
    }
    if (tshirtFile.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "T-shirt image exceeds 10 MB limit." }, { status: 400 });
    }

    const tshirtBuffer = Buffer.from(await tshirtFile.arrayBuffer());
    const tshirtBase64 = tshirtBuffer.toString("base64");
    const tshirtMimeType = tshirtFile.type;

    // ── AI validation: is it actually a T-shirt? ─────────────────────────────
    const validation = await validateTshirtImage(tshirtBase64, tshirtMimeType);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: `The uploaded image doesn't appear to be a T-shirt or wearable garment.${
            validation.reason ? ` (${validation.reason})` : ""
          } Please upload a plain T-shirt photo.`,
          invalidTshirt: true,
        },
        { status: 422 }
      );
    }

    // ── Validate design file ─────────────────────────────────────────────────
    if (!designFile || designFile.size === 0) {
      return NextResponse.json({ error: "Please upload a design image." }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.includes(designFile.type)) {
      return NextResponse.json({ error: `Unsupported design image type: ${designFile.type}` }, { status: 400 });
    }
    if (designFile.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Design image exceeds 10 MB limit." }, { status: 400 });
    }

    const designBuffer = Buffer.from(await designFile.arrayBuffer());
    const designBase64 = designBuffer.toString("base64");
    const designMimeType = designFile.type;

    // ── Generate mockup via Gemini ───────────────────────────────────────────
    const output = await applyDesignToTshirt({
      tshirtBase64,
      tshirtMimeType,
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
      return NextResponse.json({ error: "Gemini quota exceeded." }, { status: 429 });
    }
    if (raw.includes("404") || raw.includes("not found for API version")) {
      return NextResponse.json({ error: "Gemini model not found. Check model names in lib/gemini.ts." }, { status: 404 });
    }
    if (raw.includes("API key") || raw.includes("API_KEY_INVALID")) {
      return NextResponse.json({ error: "Invalid Gemini API key. Check GEMINI_API_KEY in .env.local" }, { status: 401 });
    }

    return NextResponse.json({ error: raw }, { status: 500 });
  }
}
