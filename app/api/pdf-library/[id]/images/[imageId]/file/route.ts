import { NextRequest, NextResponse } from "next/server";
import { getImageFileBytes, isPdfImageLibraryConfigured } from "@/lib/pdf-image-repository";
import { isPdfLibraryConfigured } from "@/lib/pdf-library-repository";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  if (!isPdfLibraryConfigured() || !isPdfImageLibraryConfigured()) {
    return NextResponse.json(
      { error: "PDF library is not configured." },
      { status: 503 }
    );
  }

  try {
    const { id, imageId } = await params;
    const { bytes } = await getImageFileBytes(id, imageId);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load image.";
    const status = message === "Image not found." ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
