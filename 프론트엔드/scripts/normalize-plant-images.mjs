import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const plantDir = path.join(__dirname, '../public/images/plant');

const CANVAS = 1024;
const BOTTOM_PAD = 118;
const MAX_CONTENT_HEIGHT = 760;

function getAlphaBounds(data, width, height) {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha <= 20) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error('empty image');
  }

  return { minX, minY, maxX, maxY };
}

async function normalizePlantImage(filePath) {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const bounds = getAlphaBounds(data, width, height);
  const contentWidth = bounds.maxX - bounds.minX + 1;
  const contentHeight = bounds.maxY - bounds.minY + 1;

  const scale = contentHeight > MAX_CONTENT_HEIGHT ? MAX_CONTENT_HEIGHT / contentHeight : 1;
  const targetWidth = Math.round(contentWidth * scale);
  const targetHeight = Math.round(contentHeight * scale);
  const left = Math.round((CANVAS - targetWidth) / 2);
  const top = CANVAS - BOTTOM_PAD - targetHeight;

  const cropped = await sharp(filePath)
    .ensureAlpha()
    .extract({
      left: bounds.minX,
      top: bounds.minY,
      width: contentWidth,
      height: contentHeight,
    })
    .resize(targetWidth, targetHeight, { fit: 'fill' })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: cropped, left, top }])
    .png({ compressionLevel: 9 })
    .toFile(`${filePath}.tmp`);

  fs.renameSync(`${filePath}.tmp`, filePath);
  console.log(
    `normalized: ${path.basename(filePath)} (${contentWidth}x${contentHeight} -> ${targetWidth}x${targetHeight} @ ${left},${top})`,
  );
}

const files = fs
  .readdirSync(plantDir)
  .filter((name) => name.endsWith('.png'))
  .sort();

for (const file of files) {
  await normalizePlantImage(path.join(plantDir, file));
}
