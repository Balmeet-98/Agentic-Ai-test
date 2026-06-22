"use client";

export interface ExtractedPdfImage {
  id: string;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  pageNumber: number;
  regionIndex: number;
}

export interface PdfExtractionResult {
  images: ExtractedPdfImage[];
  truncated: boolean;
}

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_PAGES = 40;
const MAX_TOTAL_IMAGES = 120;
const MAX_REGIONS_PER_PAGE = 15;
const MAX_RENDER_WIDTH = 1400;
const MIN_AREA_RATIO = 0.012;
const MAX_AREA_RATIO = 0.78;
const CROP_PADDING = 10;

let workerConfigured = false;

const EXTRACTION_TIMEOUT_MS = 120_000;

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

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");

  if (!workerConfigured && typeof window !== "undefined") {
    // Bundled import.meta.url worker paths break in Next.js and can hang Safari.
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    workerConfigured = true;
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

/**
 * Renders each PDF page, detects individual product/artwork regions on white
 * backgrounds (typical catalogue layouts), and exports each as a separate PNG.
 */
export async function extractEmbeddedImagesFromPdf(
  pdfFile: File
): Promise<ExtractedPdfImage[]> {
  const result = await extractImagesFromPdf(pdfFile);
  return result.images;
}

async function extractImagesFromPdfInternal(pdfFile: File): Promise<PdfExtractionResult> {
  if (
    pdfFile.type !== "application/pdf" &&
    !pdfFile.name.toLowerCase().endsWith(".pdf")
  ) {
    throw new Error("Please upload a PDF file.");
  }
  if (pdfFile.size > MAX_PDF_BYTES) {
    throw new Error("PDF exceeds the 25 MB limit.");
  }

  const pdfjs = await loadPdfJs();

  let pdf;
  try {
    const data = new Uint8Array(await pdfFile.arrayBuffer());
    pdf = await pdfjs.getDocument({ data }).promise;
  } catch {
    throw new Error("Could not read this PDF. The file may be corrupt or password-protected.");
  }

  const results: ExtractedPdfImage[] = [];
  let truncated = false;
  const pageCount = Math.min(pdf.numPages, MAX_PAGES);
  if (pdf.numPages > MAX_PAGES) truncated = true;

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    if (results.length >= MAX_TOTAL_IMAGES) {
      truncated = true;
      break;
    }

    await yieldToMain();

    const page = await pdf.getPage(pageNum);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2, MAX_RENDER_WIDTH / Math.max(baseViewport.width, 1));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) continue;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pageArea = canvas.width * canvas.height;
    let regions = findContentRegions(imageData, pageArea);
    regions = refineRegions(imageData, regions, pageArea);

    if (regions.length === 0) continue;

    let regionIndex = 0;
    for (const region of regions) {
      if (results.length >= MAX_TOTAL_IMAGES) {
        truncated = true;
        break;
      }

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
  }

  if (results.length === 0) {
    throw new Error(
      "No individual images could be detected in this PDF. Pages may be full-bleed or use non-white backgrounds."
    );
  }

  return { images: results, truncated };
}

export async function extractImagesFromPdf(pdfFile: File): Promise<PdfExtractionResult> {
  if (typeof window === "undefined") {
    throw new Error("PDF extraction is only available in the browser.");
  }

  return withTimeout(
    extractImagesFromPdfInternal(pdfFile),
    EXTRACTION_TIMEOUT_MS,
    "PDF processing timed out. Try a smaller file or a different browser."
  );
}

export function revokeExtractedImages(images: ExtractedPdfImage[]) {
  for (const img of images) {
    URL.revokeObjectURL(img.previewUrl);
  }
}
