import { NextRequest, NextResponse } from "next/server";
import {
  countPdfImages,
  isPdfImageLibraryConfigured,
  listPdfImages,
} from "@/lib/pdf-image-repository";
import { getPdfDocument, isPdfLibraryConfigured } from "@/lib/pdf-library-repository";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isPdfLibraryConfigured() || !isPdfImageLibraryConfigured()) {
    return NextResponse.json(
      { error: "PDF library is not configured.", images: [] },
      { status: 503 }
    );
  }

  try {
    const { id } = await params;
    const document = await getPdfDocument(id);
    if (!document) {
      return NextResponse.json({ error: "PDF not found." }, { status: 404 });
    }

    const q = req.nextUrl.searchParams.get("q") ?? undefined;
    const images = await listPdfImages(id, q);
    const total = await countPdfImages(id);

    return NextResponse.json({
      document: {
        id: document.id,
        title: document.title,
        analysisStatus: document.analysisStatus,
      },
      images: images.map((img) => ({
        id: img.id,
        pdfDocumentId: img.pdfDocumentId,
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
      total,
      filtered: images.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list images.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
