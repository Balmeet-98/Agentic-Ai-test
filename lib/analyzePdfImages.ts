import { GoogleGenAI } from "@google/genai";

export interface PdfImageLabel {
  index: number;
  productType: string | null;
  labels: string[];
  description: string | null;
  isMerchandise: boolean;
}

export interface PdfImageLabelInput {
  index: number;
  base64: string;
  mimeType: string;
}

const BATCH_PROMPT = `You are analyzing merchandise product images extracted from a supplier catalogue PDF.
You will receive N images in order (index 0 through N-1).

For EACH image, identify the physical merchandise product shown (clothing, hat, mug, bag, etc.).
Include synonym labels so search works (e.g. hat → cap, baseball cap).

Answer ONLY with a JSON object (no markdown):
{
  "images": [
    {
      "index": 0,
      "productType": "hat",
      "labels": ["hat", "cap", "merchandise"],
      "description": "Short description",
      "isMerchandise": true
    }
  ]
}

Rules:
- productType: primary category (hat, t-shirt, mug, hoodie, bag, etc.) or null
- labels: lowercase search tags including synonyms
- isMerchandise: false for logos, icons, decorative graphics, text-only, or non-products
- Return one entry per image index provided`;

function parseLabelResponse(text: string, expectedCount: number): PdfImageLabel[] | null {
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as {
      images?: Array<{
        index?: number;
        productType?: string | null;
        labels?: string[];
        description?: string | null;
        isMerchandise?: boolean;
      }>;
    };

    if (!Array.isArray(parsed.images) || parsed.images.length === 0) {
      return null;
    }

    const byIndex = new Map<number, PdfImageLabel>();
    for (const item of parsed.images) {
      if (typeof item.index !== "number") continue;
      byIndex.set(item.index, {
        index: item.index,
        productType: item.productType ?? null,
        labels: Array.isArray(item.labels)
          ? item.labels.map((l) => String(l).toLowerCase().trim()).filter(Boolean)
          : [],
        description: item.description ?? null,
        isMerchandise: item.isMerchandise !== false,
      });
    }

    const result: PdfImageLabel[] = [];
    for (let i = 0; i < expectedCount; i++) {
      result.push(
        byIndex.get(i) ?? {
          index: i,
          productType: null,
          labels: [],
          description: null,
          isMerchandise: true,
        }
      );
    }
    return result;
  } catch {
    return null;
  }
}

async function callGeminiBatch(
  images: PdfImageLabelInput[]
): Promise<PdfImageLabel[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: `${BATCH_PROMPT}\n\nNumber of images: ${images.length}` },
  ];

  for (const img of images) {
    parts.push({ text: `Image index ${img.index}:` });
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: { role: "user", parts },
  });

  const text =
    response.candidates?.[0]?.content?.parts
      ?.map((p) => p.text)
      .filter(Boolean)
      .join("")
      .trim() ?? "";

  return parseLabelResponse(text, images.length);
}

/**
 * Labels up to 10 catalogue images in a single Gemini vision call.
 */
export async function analyzePdfImagesBatch(
  images: PdfImageLabelInput[]
): Promise<PdfImageLabel[]> {
  if (images.length === 0) return [];
  if (images.length > 10) {
    throw new Error("Batch size exceeds 10 images.");
  }

  let labels = await callGeminiBatch(images);

  if (!labels && images.length > 1) {
    const half = Math.ceil(images.length / 2);
    const [a, b] = await Promise.all([
      analyzePdfImagesBatch(images.slice(0, half)),
      analyzePdfImagesBatch(images.slice(half)),
    ]);
    return [...a, ...b];
  }

  if (!labels) {
    return images.map((img) => ({
      index: img.index,
      productType: null,
      labels: [],
      description: null,
      isMerchandise: true,
    }));
  }

  return labels;
}

export const PDF_IMAGE_LABEL_BATCH_SIZE = 10;
