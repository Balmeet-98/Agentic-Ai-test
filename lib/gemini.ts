import { GoogleGenAI } from "@google/genai";

export interface GenerateDesignParams {
  tshirtBase64: string;
  tshirtMimeType: string;
  designBase64: string;
  designMimeType: string;
  placementHint?: string;
}

export interface GenerateDesignResult {
  imageBase64: string;
  mimeType: string;
  modelUsed: string;
}

// Primary model — retried up to 3 times on 503, then falls back to Canvas
const MODEL_CHAIN = [
  "gemini-3.1-flash-image-preview",   // Nano Banana 2 — fast, great quality
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isOverloaded(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("503") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("high demand") ||
    msg.includes("overloaded")
  );
}

async function callModel(
  ai: GoogleGenAI,
  model: string,
  prompt: string,
  params: GenerateDesignParams
): Promise<GenerateDesignResult> {
  const response = await ai.models.generateContent({
    model,
    contents: [
      { text: prompt },
      { inlineData: { mimeType: params.tshirtMimeType, data: params.tshirtBase64 } },
      { inlineData: { mimeType: params.designMimeType, data: params.designBase64 } },
    ],
    config: { responseModalities: ["TEXT", "IMAGE"] },
  });

  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      return {
        imageBase64: part.inlineData.data,
        mimeType: part.inlineData.mimeType ?? "image/png",
        modelUsed: model,
      };
    }
  }

  const textFallback = response.candidates?.[0]?.content?.parts
    ?.map((p) => p.text)
    .filter(Boolean)
    .join(" ");

  throw new Error(
    textFallback
      ? `Model returned text instead of an image: ${textFallback}`
      : `Model did not return an image (finish reason: ${response.candidates?.[0]?.finishReason ?? "unknown"})`
  );
}

export async function applyDesignToTshirt(
  params: GenerateDesignParams
): Promise<GenerateDesignResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

  const ai = new GoogleGenAI({ apiKey });

  const placement = params.placementHint?.trim()
    ? `Place the design ${params.placementHint}.`
    : "Place the design centered on the front chest area of the T-shirt.";

  const prompt = `You are a professional T-shirt mockup designer.
Given:
1. A plain T-shirt image (first image).
2. A custom design / graphic (second image).

Task: Generate a realistic, high-quality product mockup image showing the T-shirt with the custom design printed on it.
${placement}
Keep the T-shirt's original color, folds, shadows, and wrinkles. Blend the design naturally so it looks like it is actually printed on the fabric — respect the fabric texture and curvature. Output only the final T-shirt mockup image with no background text or extra elements.`;

  let lastError: unknown;

  for (let i = 0; i < MODEL_CHAIN.length; i++) {
    const model = MODEL_CHAIN[i];
    // Retry each model up to 3 times with exponential backoff on 503
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await callModel(ai, model, prompt, params);
        console.log(`[gemini] Success with ${model} (attempt ${attempt + 1})`);
        return result;
      } catch (err) {
        lastError = err;
        if (isOverloaded(err)) {
          const wait = (attempt + 1) * 3000; // 3s, 6s, 9s
          console.warn(`[gemini] ${model} overloaded (attempt ${attempt + 1}), waiting ${wait}ms…`);
          await sleep(wait);
          continue; // retry same model
        }
        // Non-overload error → skip to next model immediately
        console.warn(`[gemini] ${model} failed (non-503): ${err instanceof Error ? err.message : err}`);
        break;
      }
    }
    // If we exhausted retries for this model, move to the next
    if (i < MODEL_CHAIN.length - 1) {
      console.warn(`[gemini] Falling back from ${model} to ${MODEL_CHAIN[i + 1]}`);
    }
  }

  throw lastError ?? new Error("All Gemini models failed.");
}
