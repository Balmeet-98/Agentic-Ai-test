export type PdfAnalysisStatus = "none" | "processing" | "complete" | "failed";

export interface PdfDocument {
  id: string;
  tenantId: string;
  title: string;
  fileName: string;
  storagePath: string;
  fileSize: number;
  pageCount: number | null;
  analysisStatus: PdfAnalysisStatus;
  createdAt: string;
}

export interface PdfExtractedImageRecord {
  id: string;
  pdfDocumentId: string;
  pageNumber: number;
  imageIndex: number;
  storagePath: string;
  width: number;
  height: number;
  productType: string | null;
  labels: string[];
  description: string | null;
  isMerchandise: boolean;
  analyzedAt: string;
}

export const PDF_LIBRARY_BUCKET = "pdf-library";
export const PDF_LIBRARY_IMAGES_BUCKET = "pdf-library-images";
export const MAX_PDF_UPLOAD_BYTES = 25 * 1024 * 1024;
export const PDF_ANALYZE_BATCH_SIZE = 10;
/** How many analyze HTTP requests run at once (after the init batch). */
export const PDF_ANALYZE_PARALLEL = 5;
