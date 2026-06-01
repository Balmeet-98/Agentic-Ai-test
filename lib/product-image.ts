import { readFile } from "fs/promises";
import path from "path";

const DEFAULT_DRUPAL_BASE = "https://www.tallshipstrading.com";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function drupalOrigin(): string {
  try {
    return new URL(process.env.DRUPAL_API_BASE ?? DEFAULT_DRUPAL_BASE).origin;
  } catch {
    return DEFAULT_DRUPAL_BASE;
  }
}

function isAllowedRemoteUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    return parsed.origin === drupalOrigin();
  } catch {
    return false;
  }
}

/**
 * Load a product image server-side (avoids browser CORS on Drupal CDN/files).
 */
export async function loadProductImage(
  imageUrl: string
): Promise<{ base64: string; mimeType: string }> {
  const trimmed = imageUrl.trim();
  if (!trimmed) {
    throw new Error("Product image URL is missing.");
  }

  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith("/products/")) {
      const filePath = path.join(process.cwd(), "public", trimmed.replace(/^\//, ""));
      const buffer = await readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeType =
        ext === ".png"
          ? "image/png"
          : ext === ".webp"
            ? "image/webp"
            : ext === ".gif"
              ? "image/gif"
              : "image/jpeg";
      return { base64: buffer.toString("base64"), mimeType };
    }

    const absolute = `${drupalOrigin()}${trimmed}`;
    return fetchRemoteImage(absolute);
  }

  if (!isAllowedRemoteUrl(trimmed)) {
    throw new Error("Product image URL is not from an allowed source.");
  }

  return fetchRemoteImage(trimmed);
}

async function fetchRemoteImage(
  url: string
): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url, {
    headers: { Accept: "image/*" },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`Failed to load product image (${res.status}).`);
  }

  const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/jpeg";
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Unsupported product image format: ${mimeType}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > 10 * 1024 * 1024) {
    throw new Error("Product image exceeds the 10 MB limit.");
  }

  return { base64: buffer.toString("base64"), mimeType };
}
