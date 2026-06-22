export type ClientLogLevel = "info" | "warn" | "error";

export interface ClientLogEntry {
  level: ClientLogLevel;
  event: string;
  message?: string;
  data?: Record<string, string | number | boolean | null>;
  context?: {
    userAgent: string;
    browser: string;
    isSafari: boolean;
    platform: string;
    viewport: string;
    path: string;
  };
  ts: string;
}

const MAX_MESSAGE_LENGTH = 500;
const MAX_DATA_KEYS = 20;

function truncate(value: string, max = MAX_MESSAGE_LENGTH): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

function detectBrowser(userAgent: string): { browser: string; isSafari: boolean } {
  const ua = userAgent;
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox/i.test(ua);
  if (isSafari) return { browser: "Safari", isSafari: true };
  if (/Edg/i.test(ua)) return { browser: "Edge", isSafari: false };
  if (/Firefox/i.test(ua)) return { browser: "Firefox", isSafari: false };
  if (/Chrome|Chromium|CriOS/i.test(ua)) return { browser: "Chrome", isSafari: false };
  return { browser: "Other", isSafari: false };
}

function getContext(): ClientLogEntry["context"] {
  if (typeof window === "undefined") return undefined;

  const { browser, isSafari } = detectBrowser(navigator.userAgent);

  return {
    userAgent: truncate(navigator.userAgent, 300),
    browser,
    isSafari,
    platform: navigator.platform ?? "unknown",
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    path: window.location.pathname,
  };
}

function sanitizeData(
  data?: Record<string, unknown>
): ClientLogEntry["data"] | undefined {
  if (!data) return undefined;

  const out: ClientLogEntry["data"] = {};
  let count = 0;

  for (const [key, value] of Object.entries(data)) {
    if (count >= MAX_DATA_KEYS) break;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      out[key] = typeof value === "string" ? truncate(value) : value;
      count++;
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

function writeToConsole(entry: ClientLogEntry) {
  const line = `[pdf-log] ${entry.event}${entry.message ? `: ${entry.message}` : ""}`;
  const payload = { ...entry };

  if (entry.level === "error") console.error(line, payload);
  else if (entry.level === "warn") console.warn(line, payload);
  else console.info(line, payload);
}

function sendToServer(entry: ClientLogEntry) {
  const body = JSON.stringify(entry);

  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/api/client-log", blob)) return;
    }
  } catch {
    // fall through to fetch
  }

  void fetch("/api/client-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    cache: "no-store",
  }).catch(() => {
    // logging must never break the app
  });
}

export function clientLog(
  level: ClientLogLevel,
  event: string,
  message?: string,
  data?: Record<string, unknown>
) {
  const entry: ClientLogEntry = {
    level,
    event,
    message: message ? truncate(message) : undefined,
    data: sanitizeData(data),
    context: getContext(),
    ts: new Date().toISOString(),
  };

  if (process.env.NODE_ENV === "development") {
    writeToConsole(entry);
  }

  if (typeof window !== "undefined") {
    sendToServer(entry);
  }
}

export function logUiEvent(
  event: string,
  data?: Record<string, unknown>,
  message?: string
) {
  clientLog("info", event, message, data);
}

export function logUiWarning(
  event: string,
  message: string,
  data?: Record<string, unknown>
) {
  clientLog("warn", event, message, data);
}

export function logUiError(
  event: string,
  error: unknown,
  data?: Record<string, unknown>
) {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";

  clientLog("error", event, message, {
    ...data,
    errorName: error instanceof Error ? error.name : "Error",
  });
}
