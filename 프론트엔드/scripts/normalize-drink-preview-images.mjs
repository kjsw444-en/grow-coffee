import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

/** PlantScene drink-solo 컨테이너 — aspect-ratio: 473 / 1024 */
export const DRINK_PREVIEW_WIDTH = 473;
export const DRINK_PREVIEW_HEIGHT = 1024;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../public/images/drink-preview');

export async function normalizeDrinkPreviewBuffer(input) {
  return sharp(input)
    .resize(DRINK_PREVIEW_WIDTH, DRINK_PREVIEW_HEIGHT, {
      fit: 'cover',
      position: 'centre',
    })
    .png()
    .toBuffer();
}

export async function normalizeDrinkPreviewFile(inputPath, outputPath = inputPath) {
  const buffer = await normalizeDrinkPreviewBuffer(inputPath);
  const target = outputPath === inputPath ? `${outputPath}.tmp` : outputPath;
  fs.writeFileSync(target, buffer);
  if (outputPath === inputPath) {
    fs.renameSync(target, outputPath);
  }
  return sharp(buffer).metadata();
}

async function main() {
  if (!fs.existsSync(outDir)) {
    console.log('no drink-preview folder');
    return;
  }

  const files = fs.readdirSync(outDir).filter((name) => name.endsWith('.png'));
  if (files.length === 0) {
    console.log('no png files');
    return;
  }

  for (const name of files) {
    const filePath = path.join(outDir, name);
    const before = await sharp(filePath).metadata();
    const meta = await normalizeDrinkPreviewFile(filePath);
    console.log(
      `${name}: ${before.width}x${before.height} -> ${meta.width}x${meta.height}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
