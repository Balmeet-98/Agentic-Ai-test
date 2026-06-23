import { NextRequest, NextResponse } from "next/server";
import { getPdfFileBytes, isPdfLibraryConfigured } from "@/lib/pdf-library-repository";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isPdfLibraryConfigured()) {
    return NextResponse.json(
      { error: "PDF library is not configured." },
      { status: 503 }
    );
  }

  try {
    const { id } = await params;
    const { document, bytes } = await getPdfFileBytes(id);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(document.fileName)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load PDF.";
    const status = message === "PDF not found." ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
