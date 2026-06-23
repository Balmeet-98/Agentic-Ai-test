import {
  getPdfLibraryTenantId,
  getSupabaseAdmin,
  isSupabaseConfigured,
} from "@/lib/supabase-admin";
import { getPdfDocument } from "@/lib/pdf-library-repository";
import {
  PDF_LIBRARY_IMAGES_BUCKET,
  type PdfAnalysisStatus,
  type PdfExtractedImageRecord,
} from "@/lib/pdf-library-types";

interface PdfExtractedImageRow {
  id: string;
  pdf_document_id: string;
  page_number: number;
  image_index: number;
  storage_path: string;
  width: number;
  height: number;
  product_type: string | null;
  labels: string[];
  description: string | null;
  is_merchandise: boolean;
  analyzed_at: string;
}

function mapRow(row: PdfExtractedImageRow): PdfExtractedImageRecord {
  return {
    id: row.id,
    pdfDocumentId: row.pdf_document_id,
    pageNumber: row.page_number,
    imageIndex: row.image_index,
    storagePath: row.storage_path,
    width: row.width,
    height: row.height,
    productType: row.product_type,
    labels: row.labels ?? [],
    description: row.description,
    isMerchandise: row.is_merchandise,
    analyzedAt: row.analyzed_at,
  };
}

export function isPdfImageLibraryConfigured(): boolean {
  return isSupabaseConfigured();
}

export async function setAnalysisStatus(
  pdfDocumentId: string,
  status: PdfAnalysisStatus
): Promise<void> {
  const tenantId = getPdfLibraryTenantId();
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("pdf_documents")
    .update({ analysis_status: status })
    .eq("tenant_id", tenantId)
    .eq("id", pdfDocumentId);

  if (error) {
    throw new Error(`Failed to update analysis status: ${error.message}`);
  }
}

export async function getAnalysisStatus(
  pdfDocumentId: string
): Promise<PdfAnalysisStatus> {
  const doc = await getPdfDocument(pdfDocumentId);
  return doc?.analysisStatus ?? "none";
}

export async function listPdfImages(
  pdfDocumentId: string,
  query?: string
): Promise<PdfExtractedImageRecord[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("pdf_extracted_images")
    .select("*")
    .eq("pdf_document_id", pdfDocumentId)
    .order("page_number", { ascending: true })
    .order("image_index", { ascending: true });

  if (error) {
    throw new Error(`Failed to list PDF images: ${error.message}`);
  }

  let rows = (data as PdfExtractedImageRow[]).map(mapRow);

  const q = query?.trim().toLowerCase();
  if (q) {
    rows = rows.filter((img) => {
      if (img.productType?.toLowerCase().includes(q)) return true;
      if (img.description?.toLowerCase().includes(q)) return true;
      return img.labels.some(
        (label) => label.includes(q) || label.split(/\s+/).some((w) => w === q)
      );
    });
  }

  return rows;
}

export interface UpsertPdfImageInput {
  pageNumber: number;
  imageIndex: number;
  fileBytes: ArrayBuffer;
  width: number;
  height: number;
  productType?: string | null;
  labels?: string[];
  description?: string | null;
  isMerchandise?: boolean;
}

export async function upsertAnalyzedImages(
  pdfDocumentId: string,
  images: UpsertPdfImageInput[]
): Promise<PdfExtractedImageRecord[]> {
  const tenantId = getPdfLibraryTenantId();
  const supabase = getSupabaseAdmin();

  return Promise.all(
    images.map(async (img) => {
      const id = crypto.randomUUID();
      const storagePath = `${tenantId}/${pdfDocumentId}/${id}.png`;

      const { error: uploadError } = await supabase.storage
        .from(PDF_LIBRARY_IMAGES_BUCKET)
        .upload(storagePath, img.fileBytes, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Failed to upload image: ${uploadError.message}`);
      }

      const { data, error } = await supabase
        .from("pdf_extracted_images")
        .upsert(
          {
            id,
            pdf_document_id: pdfDocumentId,
            page_number: img.pageNumber,
            image_index: img.imageIndex,
            storage_path: storagePath,
            width: img.width,
            height: img.height,
            product_type: img.productType ?? null,
            labels: img.labels ?? [],
            description: img.description ?? null,
            is_merchandise: img.isMerchandise !== false,
            analyzed_at: new Date().toISOString(),
          },
          { onConflict: "pdf_document_id,page_number,image_index" }
        )
        .select("*")
        .single();

      if (error) {
        throw new Error(`Failed to save image metadata: ${error.message}`);
      }

      return mapRow(data as PdfExtractedImageRow);
    })
  );
}

export async function getImageFileBytes(
  pdfDocumentId: string,
  imageId: string
): Promise<{ record: PdfExtractedImageRecord; bytes: ArrayBuffer }> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("pdf_extracted_images")
    .select("*")
    .eq("pdf_document_id", pdfDocumentId)
    .eq("id", imageId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load image: ${error.message}`);
  }
  if (!data) {
    throw new Error("Image not found.");
  }

  const record = mapRow(data as PdfExtractedImageRow);
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(PDF_LIBRARY_IMAGES_BUCKET)
    .download(record.storagePath);

  if (downloadError || !fileData) {
    throw new Error(
      `Failed to download image: ${downloadError?.message ?? "unknown error"}`
    );
  }

  return { record, bytes: await fileData.arrayBuffer() };
}

export async function deletePdfImages(pdfDocumentId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { data, error: listError } = await supabase
    .from("pdf_extracted_images")
    .select("storage_path")
    .eq("pdf_document_id", pdfDocumentId);

  if (listError) {
    throw new Error(`Failed to list images for deletion: ${listError.message}`);
  }

  const paths = (data ?? []).map((r: { storage_path: string }) => r.storage_path);
  if (paths.length > 0) {
    await supabase.storage.from(PDF_LIBRARY_IMAGES_BUCKET).remove(paths);
  }

  const { error } = await supabase
    .from("pdf_extracted_images")
    .delete()
    .eq("pdf_document_id", pdfDocumentId);

  if (error) {
    throw new Error(`Failed to delete images: ${error.message}`);
  }
}

export async function countPdfImages(pdfDocumentId: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from("pdf_extracted_images")
    .select("*", { count: "exact", head: true })
    .eq("pdf_document_id", pdfDocumentId);

  if (error) {
    throw new Error(`Failed to count images: ${error.message}`);
  }
  return count ?? 0;
}
