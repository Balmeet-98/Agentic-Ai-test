import { NextRequest, NextResponse } from "next/server";
import {
  createPdfDocument,
  isPdfLibraryConfigured,
  listPdfDocuments,
} from "@/lib/pdf-library-repository";
import { MAX_PDF_UPLOAD_BYTES } from "@/lib/pdf-library-types";

export async function GET() {
  if (!isPdfLibraryConfigured()) {
    return NextResponse.json(
      {
        error:
          "PDF library is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        documents: [],
      },
      { status: 503 }
    );
  }

  try {
    const documents = await listPdfDocuments();
    return NextResponse.json({ documents });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list PDFs.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isPdfLibraryConfigured()) {
    return NextResponse.json(
      { error: "PDF library is not configured." },
      { status: 503 }
    );
  }

  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing PDF file." }, { status: 400 });
    }

    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      return NextResponse.json({ error: "Only PDF files are allowed." }, { status: 400 });
    }

    if (file.size > MAX_PDF_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "PDF exceeds the 25 MB limit." },
        { status: 400 }
      );
    }

    const title =
      (form.get("title") as string | null)?.trim() ||
      file.name.replace(/\.pdf$/i, "") ||
      file.name;

    const pageCountRaw = form.get("pageCount");
    const pageCount =
      typeof pageCountRaw === "string" && pageCountRaw.trim()
        ? Number.parseInt(pageCountRaw, 10)
        : null;

    const fileBytes = await file.arrayBuffer();
    const document = await createPdfDocument({
      title,
      fileName: file.name,
      fileBytes,
      pageCount: Number.isFinite(pageCount) ? pageCount : null,
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
