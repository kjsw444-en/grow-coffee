import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imagesDir = path.join(__dirname, '../public/images');

/** 가장자리와 연결된 순수 검정 배경만 제거 — 고양이(눈·털) 픽셀은 건드리지 않음 */
const blackThreshold = 18;

const jobs = [
  { source: 'cat-character.png', output: 'cat-button.png' },
  { source: 'cat-pressed-character.png', output: 'cat-button-pressed.png' },
];

function isOuterBackground(r, g, b) {
  return r <= blackThreshold && g <= blackThreshold && b <= blackThreshold;
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

  let removed = 0;
  while (queue.length > 0) {
    const idx = queue.pop();
    const i = idx * 4;
    data[i + 3] = 0;
    removed += 1;

    const x = idx % width;
    const y = Math.floor(idx / width);
    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];

    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      pushIfBackground(nx, ny);
    }
  }

  await sharp(data, {
    raw: { width, height, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toFile(`${outputPath}.tmp`);

  fs.renameSync(`${outputPath}.tmp`, outputPath);
  console.log(`edge-only transparentized: ${path.basename(outputPath)} (${removed} px)`);
}

for (const job of jobs) {
  const sourcePath = path.join(imagesDir, job.source);
  const outputPath = path.join(imagesDir, job.output);
  if (!fs.existsSync(sourcePath)) {
    console.warn(`skip missing source: ${job.source}`);
    continue;
  }
  await transparentizeFromEdges(sourcePath, outputPath);
}
