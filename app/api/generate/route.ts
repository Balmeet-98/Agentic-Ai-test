import { NextRequest, NextResponse } from "next/server";
import { applyDesignToTshirt } from "@/lib/gemini";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

async function urlToBase64(
  url: string
): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch image URL (${res.status}): ${url}`);
  }
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const mimeType = contentType.split(";")[0].trim();
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Unsupported image type from URL: ${mimeType}`);
  }
  const buffer = await res.arrayBuffer();
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error("Image from URL exceeds 10 MB limit.");
  }
  const base64 = Buffer.from(buffer).toString("base64");
  return { base64, mimeType };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const tshirtFile = formData.get("tshirt") as File | null;
    const tshirtUrl = formData.get("tshirtUrl") as string | null;
    const designFile = formData.get("design") as File | null;
    const placementHint = (formData.get("placement") as string | null) ?? "";

    // ── Resolve T-shirt image ────────────────────────────────────────────────
    let tshirtBase64: string;
    let tshirtMimeType: string;

    if (tshirtFile && tshirtFile.size > 0) {
      if (!ALLOWED_MIME_TYPES.includes(tshirtFile.type)) {
        return NextResponse.json(
          { error: `Unsupported T-shirt image type: ${tshirtFile.type}` },
          { status: 400 }
        );
      }
      if (tshirtFile.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: "T-shirt image exceeds 10 MB limit." },
          { status: 400 }
        );
      }
      const buffer = Buffer.from(await tshirtFile.arrayBuffer());
      tshirtBase64 = buffer.toString("base64");
      tshirtMimeType = tshirtFile.type;
    } else if (tshirtUrl?.trim()) {
      const result = await urlToBase64(tshirtUrl.trim());
      tshirtBase64 = result.base64;
      tshirtMimeType = result.mimeType;
    } else {
      return NextResponse.json(
        { error: "Please upload a T-shirt image or provide a URL." },
        { status: 400 }
      );
    }

    // ── Resolve design image ─────────────────────────────────────────────────
    if (!designFile || designFile.size === 0) {
      return NextResponse.json(
        { error: "Please upload a design image." },
        { status: 400 }
      );
    }
    if (!ALLOWED_MIME_TYPES.includes(designFile.type)) {
      return NextResponse.json(
        { error: `Unsupported design image type: ${designFile.type}` },
        { status: 400 }
      );
    }
    if (designFile.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "Design image exceeds 10 MB limit." },
        { status: 400 }
      );
    }
    const designBuffer = Buffer.from(await designFile.arrayBuffer());
    const designBase64 = designBuffer.toString("base64");
    const designMimeType = designFile.type;

    // ── Call Gemini ──────────────────────────────────────────────────────────
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
      return NextResponse.json(
        { error: "Gemini quota exceeded on the free tier.", quotaExceeded: true },
        { status: 429 }
      );
    }
    if (raw.includes("404") || raw.includes("not found")) {
      return NextResponse.json(
        { error: "Gemini model not found. It may be unavailable in your region." },
        { status: 404 }
      );
    }
    if (raw.includes("API key") || raw.includes("API_KEY_INVALID")) {
      return NextResponse.json(
        { error: "Invalid Gemini API key. Check GEMINI_API_KEY in .env.local" },
        { status: 401 }
      );
    }

    return NextResponse.json({ error: raw }, { status: 500 });
  }
}
