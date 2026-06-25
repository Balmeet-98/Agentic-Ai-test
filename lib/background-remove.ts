import sharp from "sharp";

export interface RemoveBackgroundDeterministicOptions {
  /**
   * Pixels closer to white than this are treated as background candidates.
   * 0 = only pure white, 255 = everything.
   */
  whiteThreshold?: number;
  /** Keep components >= this many pixels (in addition to always keeping the largest). */
  minComponentArea?: number;
}

export interface RemoveBackgroundDeterministicResult {
  pngBuffer: Buffer;
}

function isNearWhite(r: number, g: number, b: number, threshold: number): boolean {
  // Max channel distance from white
  return 255 - r <= threshold && 255 - g <= threshold && 255 - b <= threshold;
}

/**
 * Deterministic "remove background to white" for images that have a mostly-white background
 * and a single main subject (largest non-white connected component).
 *
 * This preserves subject pixels exactly (no AI, no recolor), and paints everything else #FFF.
 */
export async function removeBackgroundToWhiteDeterministic(
  input: Buffer,
  opts: RemoveBackgroundDeterministicOptions = {}
): Promise<RemoveBackgroundDeterministicResult> {
  const whiteThreshold = opts.whiteThreshold ?? 18;
  const minComponentArea = opts.minComponentArea ?? 800;

  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const channels = info.channels; // should be 4
  const size = width * height;

  // Foreground candidate = NOT near-white and not transparent
  const fg = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    const o = i * channels;
    const r = data[o] ?? 255;
    const g = data[o + 1] ?? 255;
    const b = data[o + 2] ?? 255;
    const a = data[o + 3] ?? 255;
    if (a < 10) continue;
    if (!isNearWhite(r, g, b, whiteThreshold)) fg[i] = 1;
  }

  // Connected components on fg mask (4-neighbor)
  const visited = new Uint8Array(size);
  const keep = new Uint8Array(size);

  let largestArea = 0;
  let largestSeed = -1;

  const queue = new Int32Array(size > 2_000_000 ? 2_000_000 : size); // cap to avoid huge alloc

  function floodFill(seed: number, mark?: Uint8Array): number {
    let qh = 0;
    let qt = 0;
    queue[qt++] = seed;
    visited[seed] = 1;
    if (mark) mark[seed] = 1;
    let area = 0;

    while (qh < qt) {
      const idx = queue[qh++]!;
      area++;

      const x = idx % width;
      const y = (idx / width) | 0;

      // left
      if (x > 0) {
        const n = idx - 1;
        if (!visited[n] && fg[n]) {
          visited[n] = 1;
          if (mark) mark[n] = 1;
          queue[qt++] = n;
        }
      }
      // right
      if (x + 1 < width) {
        const n = idx + 1;
        if (!visited[n] && fg[n]) {
          visited[n] = 1;
          if (mark) mark[n] = 1;
          queue[qt++] = n;
        }
      }
      // up
      if (y > 0) {
        const n = idx - width;
        if (!visited[n] && fg[n]) {
          visited[n] = 1;
          if (mark) mark[n] = 1;
          queue[qt++] = n;
        }
      }
      // down
      if (y + 1 < height) {
        const n = idx + width;
        if (!visited[n] && fg[n]) {
          visited[n] = 1;
          if (mark) mark[n] = 1;
          queue[qt++] = n;
        }
      }

      // Queue overflow guard (extremely large component) — fall back to marking as we go.
      if (qt >= queue.length - 4) break;
    }

    return area;
  }

  // First pass: find largest component seed
  for (let i = 0; i < size; i++) {
    if (!fg[i] || visited[i]) continue;
    const area = floodFill(i);
    if (area > largestArea) {
      largestArea = area;
      largestSeed = i;
    }
  }

  // Reset visited for second pass marking components we keep
  visited.fill(0);

  // Always keep largest component (main subject)
  if (largestSeed >= 0) {
    floodFill(largestSeed, keep);
  }

  // Keep other components that are "large enough" (rarely needed, but helps multi-part subjects)
  for (let i = 0; i < size; i++) {
    if (!fg[i] || visited[i] || keep[i]) continue;
    const before = visited[i] ? 0 : 1;
    const area = floodFill(i);
    // If floodFill didn't start due to visited state, skip.
    if (!before) continue;
    if (area >= minComponentArea) {
      // Mark this component by re-filling (cheap enough for few components)
      // Reset visited marks for this component by performing another fill that writes into keep.
      // Note: visited is already set from previous fill, so we need a temp visited for this component.
      // Simplest: mark from scratch with a local stack using keep as guard:
      const localVisited = new Uint8Array(size);
      let qh = 0;
      let qt = 0;
      queue[qt++] = i;
      localVisited[i] = 1;
      keep[i] = 1;
      while (qh < qt) {
        const idx = queue[qh++]!;
        const x = idx % width;
        const y = (idx / width) | 0;
        const push = (n: number) => {
          if (!localVisited[n] && fg[n]) {
            localVisited[n] = 1;
            keep[n] = 1;
            queue[qt++] = n;
          }
        };
        if (x > 0) push(idx - 1);
        if (x + 1 < width) push(idx + 1);
        if (y > 0) push(idx - width);
        if (y + 1 < height) push(idx + width);
        if (qt >= queue.length - 4) break;
      }
    }
  }

  // Compose output: keep subject pixels, paint everything else solid white.
  const out = Buffer.allocUnsafe(size * 4);
  for (let i = 0; i < size; i++) {
    const o = i * 4;
    if (keep[i]) {
      const si = i * channels;
      out[o] = data[si] ?? 255;
      out[o + 1] = data[si + 1] ?? 255;
      out[o + 2] = data[si + 2] ?? 255;
      out[o + 3] = 255;
    } else {
      out[o] = 255;
      out[o + 1] = 255;
      out[o + 2] = 255;
      out[o + 3] = 255;
    }
  }

  const pngBuffer = await sharp(out, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  return { pngBuffer };
}

