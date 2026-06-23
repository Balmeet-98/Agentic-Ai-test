import { PDF_LIBRARY_BUCKET } from "@/lib/pdf-library-types";

/**
 * Upload a PDF directly to Supabase Storage using a signed URL from the API.
 * Bypasses Vercel's ~4.5 MB serverless request body limit.
 */
export async function uploadPdfViaSignedUrl(
  signedUrl: string,
  token: string,
  storagePath: string,
  file: File
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured.");
  }

  // Prefer official helper when anon key is available.
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (anonKey) {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await supabase.storage
      .from(PDF_LIBRARY_BUCKET)
      .uploadToSignedUrl(storagePath, token, file, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (error) {
      throw new Error(error.message);
    }
    return;
  }

  // Fallback: PUT to the signed URL (no anon key required on client).
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/pdf",
      "x-upsert": "false",
    },
    body: file,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      text || `Direct upload failed (${res.status}). Add NEXT_PUBLIC_SUPABASE_ANON_KEY for reliable uploads.`
    );
  }
}
