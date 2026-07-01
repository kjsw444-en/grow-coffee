import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imagesDir = path.join(__dirname, '../public/images');

/** 가장자리와 연결된 밝은 배경(흰색·연회색·연한 하늘색)만 제거 */
function isOuterBackground(r, g, b, a) {
  if (a <= 8) return true;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  const saturation = max === 0 ? 0 : (max - min) / max;

  if (luminance >= 235 && saturation <= 0.12) return true;
  if (luminance >= 220 && saturation <= 0.08) return true;

  return r >= 210 && g >= 210 && b >= 210 && max - min <= 28;
}

async function transparentizeFromEdges(inputPath, outputPath) {
  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const visited = new Uint8Array(width * height);
  const queue = [];

  const pushIfBackground = (x, y) => {
    const idx = y * width + x;
    if (visited[idx]) return;
    const i = idx * 4;
    if (!isOuterBackground(data[i], data[i + 1], data[i + 2], data[i + 3])) return;
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

  let removed = 0;
  while (queue.length > 0) {
    const idx = queue.pop();
    const i = idx * 4;
    data[i + 3] = 0;
    removed += 1;

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

  const tmpPath = `${outputPath}.tmp`;
  await sharp(data, {
    raw: { width, height, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toFile(tmpPath);

  fs.renameSync(tmpPath, outputPath);
  console.log(`transparentized: ${path.basename(outputPath)} (${removed} px)`);
}

const target = path.join(imagesDir, 'daily-ritual-cat-gift-box.png');
if (!fs.existsSync(target)) {
  console.error('missing:', target);
  process.exit(1);
}

await transparentizeFromEdges(target, target);
