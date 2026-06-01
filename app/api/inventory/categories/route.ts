import { NextResponse } from "next/server";
import { getInventoryRepository } from "@/lib/inventory-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const repo = getInventoryRepository();
    const categories = await repo.listCategories();
    return NextResponse.json(
      { categories },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to load categories.";
    console.error("[/api/inventory/categories]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
