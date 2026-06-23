import {
  getPdfLibraryTenantId,
  getSupabaseAdmin,
  isSupabaseConfigured,
} from "@/lib/supabase-admin";
import {
  MAX_PDF_UPLOAD_BYTES,
  PDF_LIBRARY_BUCKET,
  type PdfDocument,
} from "@/lib/pdf-library-types";

interface PdfDocumentRow {
  id: string;
  tenant_id: string;
  title: string;
  file_name: string;
  storage_path: string;
  file_size: number;
  page_count: number | null;
  analysis_status?: string | null;
  created_at: string;
}

function mapRow(row: PdfDocumentRow): PdfDocument {
  const status = row.analysis_status ?? "none";
  const analysisStatus =
    status === "processing" ||
    status === "complete" ||
    status === "failed"
      ? status
      : "none";

  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    fileName: row.file_name,
    storagePath: row.storage_path,
    fileSize: row.file_size,
    pageCount: row.page_count,
    analysisStatus,
    createdAt: row.created_at,
  };
}

export function isPdfLibraryConfigured(): boolean {
  return isSupabaseConfigured();
}

export async function listPdfDocuments(): Promise<PdfDocument[]> {
  const tenantId = getPdfLibraryTenantId();
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("pdf_documents")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list PDF library: ${error.message}`);
  }

  return (data as PdfDocumentRow[]).map(mapRow);
}

export async function getPdfDocument(id: string): Promise<PdfDocument | null> {
  const tenantId = getPdfLibraryTenantId();
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("pdf_documents")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load PDF document: ${error.message}`);
  }

  return data ? mapRow(data as PdfDocumentRow) : null;
}

export async function registerPdfDocumentUpload(params: {
  title: string;
  fileName: string;
  fileSize: number;
  pageCount?: number | null;
}): Promise<{
  document: PdfDocument;
  signedUrl: string;
  token: string;
  storagePath: string;
}> {
  const tenantId = getPdfLibraryTenantId();
  const supabase = getSupabaseAdmin();

  if (params.fileSize > MAX_PDF_UPLOAD_BYTES) {
    throw new Error("PDF exceeds the 25 MB limit.");
  }

  const id = crypto.randomUUID();
  const storagePath = `${tenantId}/${id}.pdf`;

  const { data: signData, error: signError } = await supabase.storage
    .from(PDF_LIBRARY_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (signError || !signData) {
    throw new Error(
      `Failed to create upload URL: ${signError?.message ?? "unknown error"}`
    );
  }

  const { data, error } = await supabase
    .from("pdf_documents")
    .insert({
      id,
      tenant_id: tenantId,
      title: params.title,
      file_name: params.fileName,
      storage_path: storagePath,
      file_size: params.fileSize,
      page_count: params.pageCount ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to save PDF metadata: ${error.message}`);
  }

  return {
    document: mapRow(data as PdfDocumentRow),
    signedUrl: signData.signedUrl,
    token: signData.token,
    storagePath,
  };
}

export async function deletePdfDocument(id: string): Promise<void> {
  const tenantId = getPdfLibraryTenantId();
  const document = await getPdfDocument(id);
  if (!document) return;

  const supabase = getSupabaseAdmin();
  await supabase.storage.from(PDF_LIBRARY_BUCKET).remove([document.storagePath]);
  await supabase
    .from("pdf_documents")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);
}

export async function createPdfDocument(params: {
  title: string;
  fileName: string;
  fileBytes: ArrayBuffer;
  pageCount?: number | null;
}): Promise<PdfDocument> {
  const tenantId = getPdfLibraryTenantId();
  const supabase = getSupabaseAdmin();

  if (params.fileBytes.byteLength > MAX_PDF_UPLOAD_BYTES) {
    throw new Error("PDF exceeds the 25 MB limit.");
  }

  const id = crypto.randomUUID();
  const storagePath = `${tenantId}/${id}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from(PDF_LIBRARY_BUCKET)
    .upload(storagePath, params.fileBytes, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload PDF: ${uploadError.message}`);
  }

  const { data, error } = await supabase
    .from("pdf_documents")
    .insert({
      id,
      tenant_id: tenantId,
      title: params.title,
      file_name: params.fileName,
      storage_path: storagePath,
      file_size: params.fileBytes.byteLength,
      page_count: params.pageCount ?? null,
    })
    .select("*")
    .single();

  if (error) {
    await supabase.storage.from(PDF_LIBRARY_BUCKET).remove([storagePath]);
    throw new Error(`Failed to save PDF metadata: ${error.message}`);
  }

  return mapRow(data as PdfDocumentRow);
}

export async function getPdfFileBytes(id: string): Promise<{
  document: PdfDocument;
  bytes: ArrayBuffer;
}> {
  const document = await getPdfDocument(id);
  if (!document) {
    throw new Error("PDF not found.");
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(PDF_LIBRARY_BUCKET)
    .download(document.storagePath);

  if (error || !data) {
    throw new Error(`Failed to download PDF: ${error?.message ?? "unknown error"}`);
  }

  return { document, bytes: await data.arrayBuffer() };
}
