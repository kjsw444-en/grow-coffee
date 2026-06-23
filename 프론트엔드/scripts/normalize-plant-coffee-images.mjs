import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const plantDir = path.join(__dirname, '../public/images/plant');
const assetsDir = path.join(
  process.env.HOME ?? process.env.USERPROFILE ?? '',
  '.cursor/projects/c-Users-USER-Projects-grow-coffee/assets',
);

/** plant-sprout / plant-bean 과 동일한 배치 기준 */
const CANVAS = 1024;
const BOTTOM_PAD = 118;
const MAX_CONTENT_HEIGHT = 760;
const BLACK_THRESHOLD = 18;

/** 원본 에셋 UUID 조각 → plant-coffee-{slug}.png */
const COFFEE_ASSET_MAP = {
  'plant-coffee-sexy-americano.png': '2b270276',
  'plant-coffee-student-coldbrew.png': '3a46d244',
  'plant-coffee-blonde-hazelnut.png': 'f5916145',
  'plant-coffee-dolce-latte.png': '4cf23b91',
  'plant-coffee-parttime-latte.png': '80ad4145',
  'plant-coffee-chic-vanilla-latte.png': '02a7c28d',
};

function isOuterBackground(r, g, b) {
  return r <= BLACK_THRESHOLD && g <= BLACK_THRESHOLD && b <= BLACK_THRESHOLD;
}

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

async function transparentizeFromEdges(inputPath) {
  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const visited = new Uint8Array(width * height);
  const queue = [];

  const pushIfBackground = (x, y) => {
    const idx = y * width + x;
    if (visited[idx]) return;
    const i = idx * 4;
    if (!isOuterBackground(data[i], data[i + 1], data[i + 2])) return;
    visited[idx] = 1;
    queue.push(idx);
  };

  for (let x = 0; x < width; x += 1) {
    pushIfBackground(x, 0);
    pushIfBackground(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    pushIfBackground(0, y);
    pushIfBackground(width - 1, y);
  }

  while (queue.length > 0) {
    const idx = queue.pop();
    const i = idx * 4;
    data[i + 3] = 0;

    const x = idx % width;
    const y = Math.floor(idx / width);
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      pushIfBackground(nx, ny);
    }
  }

  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

function resolveAssetPath(fragment) {
  if (!fs.existsSync(assetsDir)) return null;
  const match = fs.readdirSync(assetsDir).find((name) => name.includes(fragment));
  return match ? path.join(assetsDir, match) : null;
}

async function normalizeCoffeeImage(sourceBuffer, outputPath) {
  const { data, info } = await sharp(sourceBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const bounds = getAlphaBounds(data, width, height);
  const contentWidth = bounds.maxX - bounds.minX + 1;
  const contentHeight = bounds.maxY - bounds.minY + 1;

  // sprout/bean 과 동일한 세로 크기(760px) + 하단 118px 여백
  const scale = MAX_CONTENT_HEIGHT / contentHeight;
  const targetWidth = Math.round(contentWidth * scale);
  const targetHeight = MAX_CONTENT_HEIGHT;
  const left = Math.round((CANVAS - targetWidth) / 2);
  const top = CANVAS - BOTTOM_PAD - targetHeight;

  const cropped = await sharp(sourceBuffer)
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
    .toFile(`${outputPath}.tmp`);

  fs.renameSync(`${outputPath}.tmp`, outputPath);
  console.log(
    `normalized: ${path.basename(outputPath)} (${contentWidth}x${contentHeight} -> ${targetWidth}x${targetHeight} @ ${left},${top})`,
  );
}

for (const [fileName, assetFragment] of Object.entries(COFFEE_ASSET_MAP)) {
  const outputPath = path.join(plantDir, fileName);
  const assetPath = resolveAssetPath(assetFragment);

  if (!assetPath) {
    throw new Error(`asset not found for ${fileName} (${assetFragment})`);
  }

  const transparent = await transparentizeFromEdges(assetPath);
  await normalizeCoffeeImage(transparent, outputPath);
}

console.log('done: plant coffee images aligned to sprout/bean frame');
