import { NextRequest, NextResponse } from "next/server";
import {
  isPdfImageLibraryConfigured,
  listPdfImages,
  setAnalysisStatus,
} from "@/lib/pdf-image-repository";
import { getPdfDocument, isPdfLibraryConfigured } from "@/lib/pdf-library-repository";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isPdfLibraryConfigured() || !isPdfImageLibraryConfigured()) {
    return NextResponse.json(
      { error: "PDF library is not configured." },
      { status: 503 }
    );
  }

  try {
    const { id } = await params;
    const document = await getPdfDocument(id);
    if (!document) {
      return NextResponse.json({ error: "PDF not found." }, { status: 404 });
    }

    await setAnalysisStatus(id, "complete");
    const images = await listPdfImages(id);

    return NextResponse.json({
      analysisStatus: "complete",
      images: images.map((img) => ({
        id: img.id,
        pageNumber: img.pageNumber,
        imageIndex: img.imageIndex,
        width: img.width,
        height: img.height,
        productType: img.productType,
        labels: img.labels,
        description: img.description,
        isMerchandise: img.isMerchandise,
        previewUrl: `/api/pdf-library/${id}/images/${img.id}/file`,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to finalize analysis.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
