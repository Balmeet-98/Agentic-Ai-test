"use client";

import type { PDFPageProxy } from "pdfjs-dist";
import { logUiError, logUiEvent, logUiWarning } from "@/lib/client-log";

export interface ExtractedPdfImage {
  id: string;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  pageNumber: number;
  regionIndex: number;
  productType?: string | null;
  labels?: string[];
  description?: string | null;
  isMerchandise?: boolean;
  /** Set when loaded from Supabase library cache */
  libraryImageId?: string;
}

export interface PdfExtractionResult {
  images: ExtractedPdfImage[];
  truncated: boolean;
  pagesProcessed: number;
  totalPages: number;
  /** True when pixel-region fallback was used (may include catalogue text). */
  usedRegionFallback: boolean;
}

export interface PdfExtractionProgress {
  pageNum: number;
  pageCount: number;
}

export type PdfExtractionProgressCallback = (progress: PdfExtractionProgress) => void;

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_PAGES = 100;
const MAX_REGIONS_PER_PAGE = 15;
const MAX_RENDER_WIDTH = 1400;
const MIN_EMBEDDED_IMAGE_PX = 80;
const MIN_AREA_RATIO = 0.012;
const MAX_AREA_RATIO = 0.78;
const CROP_PADDING = 10;

let workerConfigured = false;

const EXTRACTION_TIMEOUT_MS = 300_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

interface RegionRect {
  x: number;
  y: number;
  w: number;
  h: number;
  area: number;
}

async function ensurePdfWorkerAvailable(workerSrc: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(workerSrc, {
      method: "GET",
      headers: { Range: "bytes=0-127" },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!res.ok && res.status !== 206) {
      throw new Error(
        "PDF engine failed to load. Refresh the page and try again."
      );
    }

    const snippet = (await res.text()).trimStart();
    if (snippet.startsWith("<") || snippet.startsWith("<!")) {
      throw new Error(
        "PDF engine is misconfigured on this server. Please refresh or try another browser."
      );
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        "PDF engine took too long to load. Check your connection and try again."
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function loadPdfJs() {
  // Legacy build polyfills Map.getOrInsertComputed for older Safari (< 26.2).
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  if (!workerConfigured && typeof window !== "undefined") {
    // Bundled import.meta.url worker paths break in Next.js and can hang Safari.
    const workerSrc = "/pdf.worker.min.mjs";
    await ensurePdfWorkerAvailable(workerSrc);
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    workerConfigured = true;
    logUiEvent("pdf.worker_configured", { workerSrc });
  }

  return pdfjs;
}

function isBackground(r: number, g: number, b: number, a: number): boolean {
  return a < 16 || (r > 247 && g > 247 && b > 247);
}

function dilateMask(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!mask[idx]) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            out[ny * width + nx] = 1;
          }
        }
      }
    }
  }
  return out;
}

function findContentRegions(
  imageData: ImageData,
  pageArea: number
): RegionRect[] {
  const { data, width, height } = imageData;
  const mask = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    mask[i] = isBackground(data[o], data[o + 1], data[o + 2], data[o + 3]) ? 0 : 1;
  }

  const closed = dilateMask(mask, width, height, 3);
  const visited = new Uint8Array(width * height);
  const minArea = pageArea * MIN_AREA_RATIO;
  const maxArea = pageArea * MAX_AREA_RATIO;
  const regions: RegionRect[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x;
      if (!closed[start] || visited[start]) continue;

      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let area = 0;
      const stack = [start];
      visited[start] = 1;

      while (stack.length > 0) {
        const cur = stack.pop()!;
        const cx = cur % width;
        const cy = (cur / width) | 0;
        area++;

        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        if (cx > 0 && closed[cur - 1] && !visited[cur - 1]) {
          visited[cur - 1] = 1;
          stack.push(cur - 1);
        }
        if (cx < width - 1 && closed[cur + 1] && !visited[cur + 1]) {
          visited[cur + 1] = 1;
          stack.push(cur + 1);
        }
        if (cy > 0 && closed[cur - width] && !visited[cur - width]) {
          visited[cur - width] = 1;
          stack.push(cur - width);
        }
        if (cy < height - 1 && closed[cur + width] && !visited[cur + width]) {
          visited[cur + width] = 1;
          stack.push(cur + width);
        }
      }

      const w = maxX - minX + 1;
      const h = maxY - minY + 1;
      if (area >= minArea && area <= maxArea && w >= 40 && h >= 40) {
        regions.push({ x: minX, y: minY, w, h, area });
      }
    }
  }

  return regions.sort((a, b) => a.y - b.y || a.x - b.x);
}

function splitByAxisGaps(
  imageData: ImageData,
  region: RegionRect,
  pageArea: number,
  axis: "x" | "y"
): RegionRect[] {
  const { width, height, data } = imageData;
  const span = axis === "y" ? region.h : region.w;
  const minBand = Math.max(8, Math.floor(span * 0.02));
  const minSubArea = pageArea * MIN_AREA_RATIO;
  const counts = new Array<number>(span).fill(0);
  const crossSpan = axis === "y" ? region.w : region.h;

  for (let i = 0; i < span; i++) {
    for (let j = 0; j < crossSpan; j++) {
      const x = axis === "y" ? region.x + j : region.x + i;
      const y = axis === "y" ? region.y + i : region.y + j;
      const o = (y * width + x) * 4;
      if (!isBackground(data[o], data[o + 1], data[o + 2], data[o + 3])) {
        counts[i]++;
      }
    }
  }

  const gapThreshold = Math.max(4, Math.floor(crossSpan * 0.08));
  const bands: RegionRect[] = [];
  let bandStart = 0;
  let inContent = false;
  let gapRun = 0;

  const flushBand = (start: number, end: number) => {
    if (end - start < minBand) return;
    const sub: RegionRect =
      axis === "y"
        ? {
            x: region.x,
            y: region.y + start,
            w: region.w,
            h: end - start,
            area: counts.slice(start, end).reduce((a, b) => a + b, 0),
          }
        : {
            x: region.x + start,
            y: region.y,
            w: end - start,
            h: region.h,
            area: counts.slice(start, end).reduce((a, b) => a + b, 0),
          };
    if (sub.area >= minSubArea) bands.push(sub);
  };

  for (let i = 0; i < span; i++) {
    const hasContent = counts[i] >= gapThreshold;
    if (hasContent) {
      if (!inContent) {
        bandStart = i;
        inContent = true;
      }
      gapRun = 0;
    } else if (inContent) {
      gapRun++;
      if (gapRun >= minBand) {
        flushBand(bandStart, i - gapRun + 1);
        inContent = false;
        gapRun = 0;
      }
    }
  }
  if (inContent) flushBand(bandStart, span);

  return bands.length >= 2 ? bands : [region];
}

function splitByHorizontalGaps(
  imageData: ImageData,
  region: RegionRect,
  pageArea: number
): RegionRect[] {
  return splitByAxisGaps(imageData, region, pageArea, "y");
}

function splitByVerticalGaps(
  imageData: ImageData,
  region: RegionRect,
  pageArea: number
): RegionRect[] {
  return splitByAxisGaps(imageData, region, pageArea, "x");
}

function splitLargeRegion(
  imageData: ImageData,
  region: RegionRect,
  pageArea: number
): RegionRect[] {
  const coverage = region.area / pageArea;
  if (coverage < 0.2) return [region];

  let parts = splitByHorizontalGaps(imageData, region, pageArea);
  if (parts.length === 1 && region.w > region.h * 0.9) {
    parts = splitByVerticalGaps(imageData, region, pageArea);
  } else if (parts.length >= 1) {
    parts = parts.flatMap((part) => {
      if (part.w > part.h * 1.15 && part.area / pageArea > 0.06) {
        const vertical = splitByVerticalGaps(imageData, part, pageArea);
        return vertical.length >= 2 ? vertical : [part];
      }
      return [part];
    });
  }

  return parts.length > 0 ? parts : [region];
}

function refineRegions(imageData: ImageData, regions: RegionRect[], pageArea: number): RegionRect[] {
  const refined: RegionRect[] = [];

  for (const region of regions) {
    const coverage = region.area / pageArea;
    if (coverage > 0.18) {
      refined.push(...splitLargeRegion(imageData, region, pageArea));
    } else {
      refined.push(region);
    }
  }

  return refined
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .slice(0, MAX_REGIONS_PER_PAGE);
}

async function cropRegionToFile(
  source: HTMLCanvasElement,
  region: RegionRect,
  pageNumber: number,
  regionIndex: number
): Promise<File | null> {
  const pad = CROP_PADDING;
  const sx = Math.max(0, region.x - pad);
  const sy = Math.max(0, region.y - pad);
  const sw = Math.min(source.width - sx, region.w + pad * 2);
  const sh = Math.min(source.height - sy, region.h + pad * 2);

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  if (!blob) return null;

  return new File(
    [blob],
    `pdf-p${pageNumber}-r${regionIndex}.png`,
    { type: "image/png" }
  );
}

interface PdfImageXObject {
  width: number;
  height: number;
  bitmap?: ImageBitmap;
  data?: Uint8Array | Uint8ClampedArray;
  kind?: number;
}

async function resolveXObject(
  page: PDFPageProxy,
  name: string
): Promise<PdfImageXObject | null> {
  try {
    const obj = await page.objs.get(name);
    return obj?.width && obj?.height ? obj : null;
  } catch {
    return null;
  }
}

async function xObjectToFile(
  img: PdfImageXObject,
  pageNumber: number,
  imageIndex: number,
  objectName: string
): Promise<File | null> {
  const { width, height } = img;
  if (width < MIN_EMBEDDED_IMAGE_PX || height < MIN_EMBEDDED_IMAGE_PX) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  if (img.bitmap) {
    ctx.drawImage(img.bitmap, 0, 0);
  } else if (img.data) {
    const { data } = img;
    let rgba: Uint8ClampedArray;
    if (data.length === width * height * 4) {
      rgba = data as Uint8ClampedArray;
    } else if (data.length === width * height * 3) {
      rgba = new Uint8ClampedArray(width * height * 4);
      for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
        rgba[j] = data[i]!;
        rgba[j + 1] = data[i + 1]!;
        rgba[j + 2] = data[i + 2]!;
        rgba[j + 3] = 255;
      }
    } else {
      return null;
    }
    ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
  } else {
    return null;
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  if (!blob) return null;

  const safeName = objectName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 32);
  return new File(
    [blob],
    `pdf-p${pageNumber}-img${imageIndex}-${safeName}.png`,
    { type: "image/png" }
  );
}

async function extractEmbeddedImagesFromPage(
  page: PDFPageProxy,
  pageNum: number,
  OPS: Record<string, number>
): Promise<ExtractedPdfImage[]> {
  const imageOpCodes = new Set(
    [
      OPS.paintImageXObject,
      OPS.paintJpegXObject,
      OPS.paintImageXObjectRepeat,
      OPS.paintImageMaskXObject,
    ].filter((v): v is number => typeof v === "number")
  );

  const opList = await page.getOperatorList();
  const seen = new Set<string>();
  const results: ExtractedPdfImage[] = [];
  let imageIndex = 0;

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    if (!imageOpCodes.has(fn)) continue;

    const args = opList.argsArray[i];
    const imgName = args?.[0];
    if (typeof imgName !== "string" || seen.has(imgName)) continue;
    seen.add(imgName);

    const xobj = await resolveXObject(page, imgName);
    if (!xobj) continue;

    imageIndex++;
    const file = await xObjectToFile(xobj, pageNum, imageIndex, imgName);
    if (!file) continue;

    results.push({
      id: `pdf-p${pageNum}-img${imageIndex}`,
      file,
      previewUrl: URL.createObjectURL(file),
      width: xobj.width,
      height: xobj.height,
      pageNumber: pageNum,
      regionIndex: imageIndex,
    });
  }

  return results;
}

async function extractRegionsFromRenderedPage(
  pdfPage: PDFPageProxy,
  pageNum: number,
  scale: number
): Promise<ExtractedPdfImage[]> {
  const viewport = pdfPage.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await pdfPage.render({ canvas, canvasContext: ctx, viewport }).promise;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pageArea = canvas.width * canvas.height;
  let regions = findContentRegions(imageData, pageArea);
  regions = refineRegions(imageData, regions, pageArea);
  if (regions.length === 0) return [];

  const results: ExtractedPdfImage[] = [];
  let regionIndex = 0;
  for (const region of regions) {
    const file = await cropRegionToFile(canvas, region, pageNum, regionIndex);
    if (!file) continue;
    regionIndex++;
    results.push({
      id: `pdf-p${pageNum}-r${regionIndex}`,
      file,
      previewUrl: URL.createObjectURL(file),
      width: Math.floor(region.w / scale),
      height: Math.floor(region.h / scale),
      pageNumber: pageNum,
      regionIndex,
    });
  }
  return results;
}

/**
 * Extracts embedded image XObjects from a PDF (primary path).
 */
export async function extractEmbeddedImagesFromPdf(
  pdfFile: File
): Promise<ExtractedPdfImage[]> {
  const result = await extractImagesFromPdf(pdfFile);
  return result.images;
}

async function extractImagesFromPdfInternal(
  data: ArrayBuffer,
  fileName: string,
  onProgress?: PdfExtractionProgressCallback
): Promise<PdfExtractionResult> {
  const lowerName = fileName.toLowerCase();
  if (!lowerName.endsWith(".pdf")) {
    throw new Error("Please upload a PDF file.");
  }
  if (data.byteLength > MAX_PDF_BYTES) {
    throw new Error("PDF exceeds the 25 MB limit.");
  }

  const pdfjs = await loadPdfJs();

  let pdf;
  try {
    const bytes = new Uint8Array(data);
    // PDF.js v6+ loads optional decoders (JBIG2/OpenJPEG/QCMS) via `wasmUrl`.
    // Without this, some PDFs can hang or render incorrectly in Safari.
    pdf = await pdfjs.getDocument({ data: bytes, wasmUrl: "/pdfjs-wasm/" }).promise;
  } catch {
    throw new Error("Could not read this PDF. The file may be corrupt or password-protected.");
  }

  const results: ExtractedPdfImage[] = [];
  const totalPages = pdf.numPages;
  const truncated = totalPages > MAX_PAGES;
  const pageCount = Math.min(totalPages, MAX_PAGES);
  let usedRegionFallback = false;

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    await yieldToMain();

    logUiEvent("pdf.page_start", { pageNum, pageCount });
    onProgress?.({ pageNum, pageCount });

    const page = await pdf.getPage(pageNum);
    const embedded = await extractEmbeddedImagesFromPage(page, pageNum, pdfjs.OPS);

    if (embedded.length > 0) {
      results.push(...embedded);
      continue;
    }

    usedRegionFallback = true;
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2, MAX_RENDER_WIDTH / Math.max(baseViewport.width, 1));
    const regionImages = await extractRegionsFromRenderedPage(page, pageNum, scale);
    results.push(...regionImages);
  }

  if (results.length === 0) {
    throw new Error(
      "No images could be extracted from this PDF. Try a catalogue PDF with embedded product photos."
    );
  }

  return {
    images: results,
    truncated,
    pagesProcessed: pageCount,
    totalPages,
    usedRegionFallback,
  };
}

async function runExtractionWithLogging(
  data: ArrayBuffer,
  fileName: string,
  fileSize: number,
  fileType: string,
  onProgress?: PdfExtractionProgressCallback
): Promise<PdfExtractionResult> {
  if (typeof window === "undefined") {
    throw new Error("PDF extraction is only available in the browser.");
  }

  const startedAt = performance.now();
  logUiEvent("pdf.extract_start", {
    fileName,
    fileSize,
    fileType,
  });

  try {
    const result = await withTimeout(
      extractImagesFromPdfInternal(data, fileName, onProgress),
      EXTRACTION_TIMEOUT_MS,
      "PDF processing timed out. Try a smaller file or a different browser."
    );

    logUiEvent("pdf.extract_success", {
      fileName,
      imageCount: result.images.length,
      truncated: result.truncated,
      pagesProcessed: result.pagesProcessed,
      totalPages: result.totalPages,
      durationMs: Math.round(performance.now() - startedAt),
    });

    return result;
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt);
    const isTimeout =
      error instanceof Error &&
      error.message.includes("PDF processing timed out");

    if (isTimeout) {
      logUiWarning("pdf.extract_timeout", error.message, {
        fileName,
        fileSize,
        durationMs,
      });
    } else {
      logUiError("pdf.extract_error", error, {
        fileName,
        fileSize,
        durationMs,
      });
    }

    throw error;
  }
}

export async function extractImagesFromPdfBlob(
  data: ArrayBuffer,
  fileName: string,
  onProgress?: PdfExtractionProgressCallback
): Promise<PdfExtractionResult> {
  return runExtractionWithLogging(
    data,
    fileName,
    data.byteLength,
    "application/pdf",
    onProgress
  );
}

export async function extractImagesFromPdf(
  pdfFile: File,
  onProgress?: PdfExtractionProgressCallback
): Promise<PdfExtractionResult> {
  if (
    pdfFile.type !== "application/pdf" &&
    !pdfFile.name.toLowerCase().endsWith(".pdf")
  ) {
    throw new Error("Please upload a PDF file.");
  }

  const data = await pdfFile.arrayBuffer();
  return runExtractionWithLogging(
    data,
    pdfFile.name,
    pdfFile.size,
    pdfFile.type || "unknown",
    onProgress
  );
}

export function revokeExtractedImages(images: ExtractedPdfImage[]) {
  for (const img of images) {
    URL.revokeObjectURL(img.previewUrl);
  }
}
