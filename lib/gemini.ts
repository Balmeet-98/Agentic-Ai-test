import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

// ── Shared safety settings ────────────────────────────────────────────────────
// Disable all safety filters so they don't silently drop image output.
// Only the four categories accepted by the v1beta API endpoint.
// The HARM_CATEGORY_IMAGE_* enum values exist in the SDK but are rejected at runtime.
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const MODEL_CHAIN = ["gemini-3.1-flash-image-preview"];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GenerateDesignParams {
  productBase64: string;
  productMimeType: string;
  designBase64: string;
  designMimeType: string;
  placementHint?: string;
}

export interface GenerateDesignResult {
  imageBase64: string;
  mimeType: string;
  modelUsed: string;
}

export interface ChatMessage {
  role: "user" | "model";
  text: string;
  imageBase64?: string;
  imageMimeType?: string;
}

export interface ChatDesignResult {
  reply: string;
  imageBase64?: string;
  mimeType?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Mockup compositing ────────────────────────────────────────────────────────

async function callMockupModel(
  ai: GoogleGenAI,
  model: string,
  prompt: string,
  params: GenerateDesignParams
): Promise<GenerateDesignResult> {
  const response = await ai.models.generateContent({
    model,
    contents: {
      role: "user",
      parts: [
        { text: prompt },
        { inlineData: { mimeType: params.productMimeType, data: params.productBase64 } },
        { inlineData: { mimeType: params.designMimeType,  data: params.designBase64  } },
      ],
    },
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      safetySettings: SAFETY_SETTINGS,
    },
  });

  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];

  console.log(
    `[gemini] ${model} — finishReason: ${candidate?.finishReason ?? "n/a"}, parts: ${parts.length}`
  );

  for (const part of parts) {
    if (part.inlineData?.data) {
      return {
        imageBase64: part.inlineData.data,
        mimeType: part.inlineData.mimeType ?? "image/png",
        modelUsed: model,
      };
    }
  }

  const textResponse = parts.map((p) => p.text).filter(Boolean).join(" ").trim();
  const finishReason = candidate?.finishReason ?? "unknown";

  throw new Error(
    textResponse
      ? `Gemini responded with text instead of an image: "${textResponse}"`
      : `Gemini did not return an image (finish reason: ${finishReason}). This is usually a temporary issue — please try again.`
  );
}

/**
 * Composites a design onto a merchandise product image.
 * Accepts any product type: clothing, mugs, hats, bags, umbrellas, phone cases, etc.
 */
export async function applyDesignToProduct(
  params: GenerateDesignParams
): Promise<GenerateDesignResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

  const ai = new GoogleGenAI({ apiKey });

  const placement = params.placementHint?.trim()
    ? `Place the design ${params.placementHint}.`
    : "Place the design in the most natural, prominent location for this type of product.";

  const prompt = `You are a professional product mockup designer.

TASK: Create a realistic merchandise mockup image.

INPUT:
- Image 1: A plain merchandise product (clothing, mug, hat, tote bag, umbrella, phone case, pillow, or any printable product)
- Image 2: A graphic design, logo, or artwork to apply to the product

OUTPUT: A single photorealistic mockup image showing the product with the design applied.

INSTRUCTIONS:
- Identify the product type and apply the design in the most natural way:
  • Clothing (T-shirt, hoodie, sweatshirt): print on fabric respecting folds and texture
  • Hard curved surfaces (mug, bottle, cup): wrap design around the curved surface naturally
  • Flat hard surfaces (phone case, canvas, pillow): apply design flat
  • Headwear (cap, hat, beanie): place design on the front panel following the curve
  • Bags (tote, backpack): print flat on the front face
  • Umbrella: distribute design symmetrically across the panels
- ${placement}
- Keep the product's original color, shape, material finish, and lighting
- Blend the design so it looks professionally printed, embroidered, or sublimated
- Match the design to any surface curves, creases, or contours
- Output only the final mockup image — no text labels, watermarks, or extra elements`;

  let lastError: unknown;

  for (let m = 0; m < MODEL_CHAIN.length; m++) {
    const model = MODEL_CHAIN[m];

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await callMockupModel(ai, model, prompt, params);
        console.log(`[gemini] ✓ ${model} succeeded (attempt ${attempt + 1})`);
        return result;
      } catch (err) {
        lastError = err;
        if (isOverloaded(err)) {
          const wait = (attempt + 1) * 3000;
          console.warn(`[gemini] ${model} overloaded (attempt ${attempt + 1}), retrying in ${wait}ms…`);
          await sleep(wait);
          continue;
        }
        console.warn(`[gemini] ${model} failed: ${err instanceof Error ? err.message : err}`);
        break;
      }
    }

  }

  throw lastError ?? new Error("Gemini image generation failed.");
}

// ── AI Design Chatbot ─────────────────────────────────────────────────────────

/**
 * Multi-turn design creation chatbot.
 * The user describes what artwork they want; Gemini iteratively generates and
 * refines the design based on the conversation history.
 */
export async function chatGenerateDesign(
  messages: ChatMessage[]
): Promise<ChatDesignResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `You are a creative graphic design assistant specializing in merchandise artwork.

CRITICAL RULES — follow these without exception:
- You MUST generate and output an actual image in every single response, no exceptions.
- NEVER write "[IMAGE]", "[image]", or any placeholder text instead of a real image.
- NEVER describe what an image would look like without generating it.
- Always output the real rendered image data as part of your response.

When the user describes a design idea:
1. Immediately generate a clean, high-quality graphic, logo, or illustration matching their description.
2. The artwork must be suitable for merchandise printing — bold shapes, clear composition, strong contrast.
3. Use a white or solid-color background (no complex photographic scenes).
4. Output BOTH a brief text explanation AND the actual generated image.
5. The image is the artwork itself — not placed on any product.

When the user asks for refinements:
1. Generate an updated version of the image with the requested changes applied.
2. Briefly describe what changed.

You must always produce a real image. Text-only responses are not acceptable.`;

  // Build Gemini conversation contents from the message history
  const contents = messages.map((msg) => ({
    role: msg.role as "user" | "model",
    parts: [
      ...(msg.text ? [{ text: msg.text }] : []),
      ...(msg.imageBase64 && msg.imageMimeType
        ? [{ inlineData: { mimeType: msg.imageMimeType, data: msg.imageBase64 } }]
        : []),
    ],
  }));

  // Retry up to 2× on 503 overload: (3s + 6s) = max ~9s wait, well within the 60s Vercel limit.
  let lastError: unknown;

  for (let m = 0; m < MODEL_CHAIN.length; m++) {
    const model = MODEL_CHAIN[m];

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            responseModalities: ["TEXT", "IMAGE"],
            safetySettings: SAFETY_SETTINGS,
          },
        });

        const candidate = response.candidates?.[0];
        const parts = candidate?.content?.parts ?? [];

        console.log(
          `[gemini chat] ${model} attempt ${attempt + 1} — finishReason: ${candidate?.finishReason ?? "n/a"}, parts: ${parts.length}`
        );

        const reply = parts
          .filter((p) => p.text)
          .map((p) => p.text)
          .join(" ")
          .trim();

        const imagePart = parts.find((p) => p.inlineData?.data);

        // Detect text-only response where model wrote a placeholder instead of generating
        const hasPlaceholder = reply.includes("[IMAGE]") || reply.includes("[image]");

        if (!imagePart?.inlineData?.data) {
          const reason = hasPlaceholder
            ? "Model described the image instead of generating it — retrying"
            : `No image returned (finish reason: ${candidate?.finishReason ?? "unknown"})`;
          console.warn(`[gemini chat] ${model}: ${reason}`);
          throw new Error(reason);
        }

        return {
          reply: reply.replace(/\*?\*?\[IMAGE\]\*?\*?/gi, "").trim() || "Here's your design.",
          imageBase64: imagePart.inlineData.data,
          mimeType: imagePart.inlineData.mimeType ?? "image/png",
        };
      } catch (err) {
        lastError = err;
        if (isOverloaded(err)) {
          const wait = (attempt + 1) * 3000;
          console.warn(
            `[gemini chat] ${model} overloaded (attempt ${attempt + 1}), retrying in ${wait}ms…`
          );
          await sleep(wait);
          continue;
        }
        // Non-overload error — stop retrying
        console.warn(
          `[gemini chat] ${model} failed (non-503): ${err instanceof Error ? err.message : err}`
        );
        break;
      }
    }
  }

  throw lastError ?? new Error("Gemini chat generation failed.");
}
