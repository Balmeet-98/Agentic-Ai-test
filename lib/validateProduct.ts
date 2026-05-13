import { GoogleGenAI } from "@google/genai";

/**
 * Uses Gemini to verify whether an image shows a physical merchandise product
 * that a design can be printed/applied on (clothing, mug, hat, bag, etc.).
 * Returns { valid: true } or { valid: false, reason: string }.
 */
export async function validateProductImage(
  base64: string,
  mimeType: string
): Promise<{ valid: boolean; reason?: string }> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: {
      role: "user",
      parts: [
        {
          text: `Look at this image carefully.
Answer ONLY with a JSON object (no markdown, no explanation):
{"isProduct": true}   — if the image shows a physical merchandise product that a graphic design could be printed or placed on. Examples: T-shirt, hoodie, sweatshirt, polo shirt, cap/hat, beanie, mug, cup, tote bag, backpack, umbrella, phone case, pillow, canvas print, or any similar printable product.
{"isProduct": false, "reason": "<short reason>"}   — if it is NOT a merchandise product (e.g. a landscape photo, portrait/face, logo, food, screenshot, abstract art, document, or anything that cannot have a design applied to it).`,
        },
        { inlineData: { mimeType, data: base64 } },
      ],
    },
  });

  const text =
    response.candidates?.[0]?.content?.parts
      ?.map((p) => p.text)
      .filter(Boolean)
      .join("")
      .trim() ?? "";

  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as { isProduct: boolean; reason?: string };
    if (parsed.isProduct === true) return { valid: true };
    if (parsed.isProduct === false) return { valid: false, reason: parsed.reason };
  } catch {
    // If Gemini returns something unparseable, be lenient
    console.warn("[validateProduct] Could not parse Gemini response:", text);
    return { valid: true };
  }

  return { valid: true };
}
