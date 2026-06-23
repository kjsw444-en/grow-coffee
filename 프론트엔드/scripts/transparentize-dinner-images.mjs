import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dinnerDir = path.join(__dirname, '../public/images/recommend/dinner');
const blackThreshold = 40;
const whiteThreshold = 235;

function isLetterbox(r, g, b) {
  const isBlack = r <= blackThreshold && g <= blackThreshold && b <= blackThreshold;
  const isWhite = r >= whiteThreshold && g >= whiteThreshold && b >= whiteThreshold;
  return isBlack || isWhite;
}

async function transparentizeLetterbox(filePath) {
  const image = sharp(filePath);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const visited = new Uint8Array(width * height);
  const queue = [];

  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];

  for (const [x, y] of corners) {
    const idx = y * width + x;
    const i = idx * 4;
    if (isLetterbox(data[i], data[i + 1], data[i + 2])) {
      queue.push(idx);
      visited[idx] = 1;
    }
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
      const nIdx = ny * width + nx;
      if (visited[nIdx]) continue;
      const ni = nIdx * 4;
      if (!isLetterbox(data[ni], data[ni + 1], data[ni + 2])) continue;
      visited[nIdx] = 1;
      queue.push(nIdx);
    }
  }

  await sharp(data, {
    raw: {
      width,
      height,
      channels: 4,
    },
  })
    .png({ compressionLevel: 9 })
    .toFile(`${filePath}.tmp`);

  fs.renameSync(`${filePath}.tmp`, filePath);
  console.log(`transparentized: ${path.basename(filePath)} (${removed} px)`);
}

const files = fs.readdirSync(dinnerDir).filter((name) => name.endsWith('.png'));

for (const file of files) {
  await transparentizeLetterbox(path.join(dinnerDir, file));
}

console.log(`done: ${files.length} files`);
