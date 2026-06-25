import { NextRequest, NextResponse } from "next/server";
import { removeBackgroundToWhiteDeterministic } from "@/lib/background-remove";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile || imageFile.size === 0) {
      return NextResponse.json({ error: "No image received." }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.includes(imageFile.type)) {
      return NextResponse.json(
        { error: `Unsupported image format: ${imageFile.type}. Use PNG, JPG, or WEBP.` },
        { status: 400 }
      );
    }
    if (imageFile.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Image exceeds the 10 MB limit." }, { status: 400 });
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());

    return NextResponse.json({
      imageBase64: (await removeBackgroundToWhiteDeterministic(imageBuffer)).pngBuffer.toString("base64"),
      mimeType: "image/png",
      modelUsed: "deterministic",
    });
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : "Unexpected error.";
    console.error("[/api/remove-background] Error:", raw);

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

