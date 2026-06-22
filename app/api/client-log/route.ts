import { NextRequest, NextResponse } from "next/server";
import type { ClientLogEntry, ClientLogLevel } from "@/lib/client-log";

const MAX_BODY_BYTES = 8_192;
const ALLOWED_LEVELS = new Set<ClientLogLevel>(["info", "warn", "error"]);

function isValidEntry(body: unknown): body is ClientLogEntry {
  if (!body || typeof body !== "object") return false;
  const entry = body as ClientLogEntry;
  return (
    ALLOWED_LEVELS.has(entry.level) &&
    typeof entry.event === "string" &&
    entry.event.length > 0 &&
    entry.event.length <= 120
  );
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: "Payload too large." }, { status: 413 });
    }

    const body = JSON.parse(raw) as unknown;
    if (!isValidEntry(body)) {
      return NextResponse.json({ ok: false, error: "Invalid log entry." }, { status: 400 });
    }

    const line = JSON.stringify({
      source: "client",
      level: body.level,
      event: body.event,
      message: body.message,
      data: body.data,
      context: body.context,
      ts: body.ts,
      vercelRequestId: req.headers.get("x-vercel-id") ?? undefined,
    });

    if (body.level === "error") {
      console.error("[pdf-log]", line);
    } else if (body.level === "warn") {
      console.warn("[pdf-log]", line);
    } else {
      console.info("[pdf-log]", line);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
}
