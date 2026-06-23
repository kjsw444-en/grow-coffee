import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dinnerDir = path.join(__dirname, '../public/images/recommend/dinner');

async function analyze(filePath) {
  const image = sharp(filePath);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const margin = Math.floor(Math.min(width, height) * 0.08);
  let cornerOpaque = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inCorner =
        (x < margin && y < margin) ||
        (x >= width - margin && y < margin) ||
        (x < margin && y >= height - margin) ||
        (x >= width - margin && y >= height - margin);
      if (!inCorner) continue;
      const i = (y * width + x) * 4;
      if (data[i + 3] >= 128) cornerOpaque += 1;
    }
  }

  const cornerTotal = margin * margin * 4;
  return {
    cornerOpaque,
    pctCornerOpaque: ((cornerOpaque / cornerTotal) * 100).toFixed(1),
  };
}

const files = fs.readdirSync(dinnerDir).filter((name) => name.endsWith('.png')).sort();
for (const file of files) {
  const s = await analyze(path.join(dinnerDir, file));
  const flag = Number(s.pctCornerOpaque) > 1 ? ' ***' : '';
  console.log(`${file.padEnd(22)} cornerOpaque:${s.pctCornerOpaque}%${flag}`);
}
