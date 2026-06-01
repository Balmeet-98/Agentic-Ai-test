import { NextRequest, NextResponse } from "next/server";

/**
 * Phase 2: sync Drupal catalog into Supabase.
 * Returns 501 until Supabase tables and sync logic are implemented.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.SYNC_SECRET?.trim();
  if (secret) {
    const provided = req.headers.get("x-sync-secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  return NextResponse.json(
    {
      error:
        "Inventory sync is not configured yet. Complete Phase 2 (Supabase tables + lib/inventory-sync.ts) then set INVENTORY_SOURCE=database.",
    },
    { status: 501 }
  );
}
