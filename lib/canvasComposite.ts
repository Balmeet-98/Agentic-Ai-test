/**
 * Client-side canvas compositing.
 * Overlays a design image centered on a T-shirt image.
 * Works entirely in the browser — no API key or billing required.
 */
export async function compositeOnCanvas(
  tshirtSrc: string,
  designSrc: string,
  placementHint?: string
): Promise<string> {
  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });

  const [shirt, design] = await Promise.all([
    loadImage(tshirtSrc),
    loadImage(designSrc),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = shirt.naturalWidth;
  canvas.height = shirt.naturalHeight;
  const ctx = canvas.getContext("2d")!;

  // Draw the T-shirt as the base layer
  ctx.drawImage(shirt, 0, 0);

  // Determine placement based on hint
  const hint = (placementHint ?? "").toLowerCase();
  const W = canvas.width;
  const H = canvas.height;

  // Design occupies ~35% of shirt width by default
  const designW = Math.round(W * 0.35);
  const scale = designW / design.naturalWidth;
  const designH = Math.round(design.naturalHeight * scale);

  let dx = Math.round((W - designW) / 2); // centered horizontally
  let dy = Math.round(H * 0.22);          // upper-chest vertically

  if (hint.includes("center")) {
    dy = Math.round((H - designH) / 2);
  } else if (hint.includes("bottom")) {
    dy = Math.round(H * 0.65);
  } else if (hint.includes("back") || hint.includes("upper back")) {
    dy = Math.round(H * 0.18);
  }
  if (hint.includes("left")) {
    dx = Math.round(W * 0.15);
  } else if (hint.includes("right")) {
    dx = Math.round(W * 0.55);
  }

  // Shadow / depth effect behind the design
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 4;

  // Multiply-like blend: draw design with Multiply blending
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 0.92;
  ctx.drawImage(design, dx, dy, designW, designH);
  ctx.restore();

  // Second pass at normal opacity to preserve colour vibrancy
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 0.55;
  ctx.drawImage(design, dx, dy, designW, designH);
  ctx.restore();

  return canvas.toDataURL("image/png");
}
