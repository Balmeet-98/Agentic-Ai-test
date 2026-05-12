import { GoogleGenAI } from "@google/genai";

/**
 * Uses a fast Gemini text model to check whether the image
 * looks like a T-shirt (or garment the design can be printed on).
 * Returns { valid: true } or { valid: false, reason: string }.
 */
export async function validateTshirtImage(
  base64: string,
  mimeType: string
): Promise<{ valid: boolean; reason?: string }> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        text: `Look at this image carefully.
Answer ONLY with a JSON object in this exact format (no markdown, no explanation):
{"isTshirt": true}   — if the image shows a plain T-shirt, shirt, hoodie, sweatshirt, or similar wearable garment suitable for print mockups.
{"isTshirt": false, "reason": "<short reason>"}   — if it is NOT a wearable garment (e.g. a landscape, face, logo, product photo, etc.).`,
      },
      {
        inlineData: { mimeType, data: base64 },
      },
    ],
  });

  const text = response.candidates?.[0]?.content?.parts
    ?.map((p) => p.text)
    .filter(Boolean)
    .join("")
    .trim() ?? "";

  try {
    // Strip any accidental markdown fences
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as { isTshirt: boolean; reason?: string };
    if (parsed.isTshirt === true)  return { valid: true };
    if (parsed.isTshirt === false) return { valid: false, reason: parsed.reason };
  } catch {
    // If Gemini returns something unparseable, be lenient and allow it through
    console.warn("[validateTshirt] Could not parse Gemini response:", text);
    return { valid: true };
  }

  return { valid: true };
}
