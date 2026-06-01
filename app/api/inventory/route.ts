import { NextRequest, NextResponse } from "next/server";
import { getInventoryRepository } from "@/lib/inventory-repository";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 12;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const categoryId = searchParams.get("categoryId") ?? undefined;
  const q = searchParams.get("q") ?? undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
  );

  try {
    const repo = getInventoryRepository();
    const result = await repo.listProducts({ categoryId, q, page, pageSize });
    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to load inventory.";
    console.error("[/api/inventory]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
