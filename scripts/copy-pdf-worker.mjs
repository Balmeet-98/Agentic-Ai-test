import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(
  root,
  "node_modules",
  "pdfjs-dist",
  "legacy",
  "build",
  "pdf.worker.min.mjs"
);
const destDir = join(root, "public");
const dest = join(destDir, "pdf.worker.min.mjs");

const wasmSourceDir = join(root, "node_modules", "pdfjs-dist", "wasm");
const wasmDestDir = join(destDir, "pdfjs-wasm");

if (!existsSync(source)) {
  console.warn("[copy-pdf-worker] pdfjs worker not found, skipping");
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(source, dest);
console.log("[copy-pdf-worker] copied pdf.worker.min.mjs to public/");

if (!existsSync(wasmSourceDir)) {
  console.warn("[copy-pdf-worker] pdfjs wasm assets not found, skipping");
  process.exit(0);
}

mkdirSync(wasmDestDir, { recursive: true });
for (const name of readdirSync(wasmSourceDir)) {
  // Avoid copying license text files; only runtime assets.
  if (name.startsWith("LICENSE_")) continue;
  const from = join(wasmSourceDir, name);
  const to = join(wasmDestDir, name);
  copyFileSync(from, to);
}
console.log("[copy-pdf-worker] copied pdfjs wasm assets to public/pdfjs-wasm/");
