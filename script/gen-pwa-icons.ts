import sharp from "sharp";

// One-off generator for PWA icons. Run with: npx tsx script/gen-pwa-icons.ts
// Source is non-square (960x936) and the UI always renders it on a white tile,
// so we composite onto a square white canvas (fit: contain) to avoid distortion.
const SRC = "client/public/tt-coat-of-arms.png";
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

async function gen(size: number, inset: number, out: string) {
  const inner = Math.round(size * inset);
  const logo = await sharp(SRC)
    .resize(inner, inner, { fit: "contain", background: WHITE })
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: WHITE },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(`client/public/${out}`);
  console.log(`wrote client/public/${out} (${size}x${size}, inset ${inset})`);
}

await Promise.all([
  gen(192, 0.92, "pwa-192x192.png"),
  gen(512, 0.92, "pwa-512x512.png"),
  gen(512, 0.7, "pwa-512x512-maskable.png"),
  gen(180, 0.88, "apple-touch-icon-180x180.png"),
]);
