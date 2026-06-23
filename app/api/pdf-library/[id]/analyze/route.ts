import { NextRequest, NextResponse } from "next/server";
import {
  analyzePdfImagesBatch,
  PDF_IMAGE_LABEL_BATCH_SIZE,
} from "@/lib/analyzePdfImages";
import {
  deletePdfImages,
  isPdfImageLibraryConfigured,
  setAnalysisStatus,
  upsertAnalyzedImages,
} from "@/lib/pdf-image-repository";
import { getPdfDocument, isPdfLibraryConfigured } from "@/lib/pdf-library-repository";

const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"];

function mapGeminiError(error: unknown): { status: number; message: string } {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
    return { status: 429, message: "AI quota exceeded. Try again later." };
  }
  if (msg.includes("401") || msg.toLowerCase().includes("api key")) {
    return { status: 401, message: "Invalid or missing GEMINI_API_KEY." };
  }
  if (msg.includes("503") || msg.toLowerCase().includes("overloaded")) {
    return { status: 503, message: "AI service is overloaded. Try again shortly." };
  }
  return { status: 500, message: msg || "Failed to analyze images." };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isPdfLibraryConfigured() || !isPdfImageLibraryConfigured()) {
    return NextResponse.json(
      { error: "PDF library is not configured." },
      { status: 503 }
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured." },
      { status: 503 }
    );
  }

  try {
    const { id } = await params;
    const document = await getPdfDocument(id);
    if (!document) {
      return NextResponse.json({ error: "PDF not found." }, { status: 404 });
    }

    const form = await req.formData();
    const batchIndex = Number.parseInt(String(form.get("batchIndex") ?? "0"), 10);
    const totalBatches = Number.parseInt(String(form.get("totalBatches") ?? "1"), 10);
    const isFirstBatch = batchIndex === 0;

    if (isFirstBatch) {
      await deletePdfImages(id);
      await setAnalysisStatus(id, "processing");
    }

    const imageEntries: Array<{
      pageNumber: number;
      imageIndex: number;
      file: File;
      width: number;
      height: number;
      batchLocalIndex: number;
    }> = [];

    for (let i = 0; i < PDF_IMAGE_LABEL_BATCH_SIZE; i++) {
      const file = form.get(`image_${i}`);
      const pageRaw = form.get(`pageNumber_${i}`);
      const indexRaw = form.get(`imageIndex_${i}`);
      const widthRaw = form.get(`width_${i}`);
      const heightRaw = form.get(`height_${i}`);

      if (!(file instanceof File) || file.size === 0) continue;

      imageEntries.push({
        pageNumber: Number.parseInt(String(pageRaw), 10),
        imageIndex: Number.parseInt(String(indexRaw), 10),
        file,
        width: Number.parseInt(String(widthRaw), 10) || 0,
        height: Number.parseInt(String(heightRaw), 10) || 0,
        batchLocalIndex: imageEntries.length,
      });
    }

    if (imageEntries.length === 0) {
      return NextResponse.json({ error: "No images in batch." }, { status: 400 });
    }

    for (const entry of imageEntries) {
      if (!ALLOWED_MIME.includes(entry.file.type) && entry.file.type !== "") {
        return NextResponse.json(
          { error: `Unsupported image type: ${entry.file.type}` },
          { status: 400 }
        );
      }
    }

    const labelInputs = await Promise.all(
      imageEntries.map(async (entry, idx) => {
        const buffer = Buffer.from(await entry.file.arrayBuffer());
        return {
          index: idx,
          base64: buffer.toString("base64"),
          mimeType: entry.file.type || "image/png",
        };
      })
    );

    const labels = await analyzePdfImagesBatch(labelInputs);

    const upserted = await upsertAnalyzedImages(
      id,
      await Promise.all(
        imageEntries.map(async (entry, idx) => {
          const label = labels[idx];
          const bytes = await entry.file.arrayBuffer();
          return {
            pageNumber: entry.pageNumber,
            imageIndex: entry.imageIndex,
            fileBytes: bytes,
            width: entry.width,
            height: entry.height,
            productType: label?.productType ?? null,
            labels: label?.labels ?? [],
            description: label?.description ?? null,
            isMerchandise: label?.isMerchandise !== false,
          };
        })
      )
    );

    return NextResponse.json({
      batchIndex,
      totalBatches,
      saved: upserted.map((img) => ({
        id: img.id,
        pageNumber: img.pageNumber,
        imageIndex: img.imageIndex,
        productType: img.productType,
        labels: img.labels,
        description: img.description,
        isMerchandise: img.isMerchandise,
        previewUrl: `/api/pdf-library/${id}/images/${img.id}/file`,
      })),
      analysisStatus: "processing",
    });
  } catch (error) {
    try {
      const { id } = await params;
      await setAnalysisStatus(id, "failed");
    } catch {
      // ignore secondary failure
    }
    const mapped = mapGeminiError(error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
