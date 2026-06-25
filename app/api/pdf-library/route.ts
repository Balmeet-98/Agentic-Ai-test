import { NextRequest, NextResponse } from "next/server";
import {
  createPdfDocument,
  DuplicatePdfDocumentError,
  findPdfDocumentByFileName,
  isPdfLibraryConfigured,
  listPdfDocuments,
  registerPdfDocumentUpload,
} from "@/lib/pdf-library-repository";
import { MAX_PDF_UPLOAD_BYTES } from "@/lib/pdf-library-types";

export async function GET(req: NextRequest) {
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
    const fileName = req.nextUrl.searchParams.get("fileName")?.trim();
    if (fileName) {
      const document = await findPdfDocumentByFileName(fileName);
      if (!document) {
        return NextResponse.json({ error: "PDF not found." }, { status: 404 });
      }
      return NextResponse.json({ document });
    }

    const documents = await listPdfDocuments();
    return NextResponse.json({ documents });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list PDFs.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Vercel serverless body limit is ~4.5 MB — large PDFs must upload direct to Supabase. */
const VERCEL_SAFE_UPLOAD_BYTES = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  if (!isPdfLibraryConfigured()) {
    return NextResponse.json(
      { error: "PDF library is not configured." },
      { status: 503 }
    );
  }

  try {
    const contentType = req.headers.get("content-type") ?? "";

    // Preferred: JSON register → client uploads PDF directly to Supabase (bypasses Vercel limit).
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as {
        title?: string;
        fileName?: string;
        fileSize?: number;
        pageCount?: number | null;
      };

      const fileName = body.fileName?.trim();
      if (!fileName || !fileName.toLowerCase().endsWith(".pdf")) {
        return NextResponse.json({ error: "fileName must be a .pdf file." }, { status: 400 });
      }

      const fileSize = body.fileSize ?? 0;
      if (fileSize <= 0) {
        return NextResponse.json({ error: "fileSize is required." }, { status: 400 });
      }
      if (fileSize > MAX_PDF_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: "PDF exceeds the 25 MB limit." },
          { status: 400 }
        );
      }

      const title =
        body.title?.trim() || fileName.replace(/\.pdf$/i, "") || fileName;
      const pageCount =
        typeof body.pageCount === "number" && Number.isFinite(body.pageCount)
          ? body.pageCount
          : null;

      const { document, signedUrl, token, storagePath } =
        await registerPdfDocumentUpload({
          title,
          fileName,
          fileSize,
          pageCount,
        });

      return NextResponse.json(
        { document, signedUrl, token, storagePath },
        { status: 201 }
      );
    }

    // Legacy multipart — only for small PDFs under Vercel's ~4.5 MB payload cap (local dev).
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

    if (file.size > VERCEL_SAFE_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error:
            "PDF is too large for server upload on Vercel. Use direct Supabase upload (JSON register).",
          code: "PAYLOAD_TOO_LARGE",
        },
        { status: 413 }
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
    if (error instanceof DuplicatePdfDocumentError) {
      return NextResponse.json(
        {
          error: error.message,
          code: "DUPLICATE_PDF",
          document: error.existing,
        },
        { status: 409 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to upload PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
