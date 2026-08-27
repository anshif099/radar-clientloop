import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const source = path.resolve("public/brand/app-icon.svg");
const outputDirectory = path.resolve("public/icons");

await mkdir(outputDirectory, { recursive: true });

const icons = [
  { file: "icon-192.png", size: 192, padding: 0 },
  { file: "icon-512.png", size: 512, padding: 0 },
  { file: "icon-maskable-192.png", size: 192, padding: 24 },
  { file: "icon-maskable-512.png", size: 512, padding: 64 },
  { file: "apple-touch-icon.png", size: 180, padding: 8 },
] as const;

await Promise.all(
  icons.map(async ({ file, size, padding }) => {
    const contentSize = size - padding * 2;
    let pipeline = sharp(source).resize(contentSize, contentSize);

    if (padding > 0) {
      pipeline = pipeline.extend({
        top: padding,
        bottom: padding,
        left: padding,
        right: padding,
        background: "#fffaf5",
      });
    }

    await pipeline.png().toFile(path.join(outputDirectory, file));
  }),
);

process.stdout.write(`Generated ${icons.length} PWA icons in public/icons\n`);
