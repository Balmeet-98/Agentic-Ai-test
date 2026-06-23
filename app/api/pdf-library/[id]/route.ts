import { NextRequest, NextResponse } from "next/server";
import {
  deletePdfDocument,
  getPdfDocument,
  isPdfLibraryConfigured,
} from "@/lib/pdf-library-repository";

/** Roll back a failed direct-to-Supabase upload (removes metadata + storage). */
export async function DELETE(
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
    const document = await getPdfDocument(id);
    if (!document) {
      return NextResponse.json({ error: "PDF not found." }, { status: 404 });
    }

    await deletePdfDocument(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
