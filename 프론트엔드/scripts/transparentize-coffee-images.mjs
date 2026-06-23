import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coffeeDir = path.join(__dirname, '../public/images/recommend/coffee');
const threshold = 28;

async function transparentizeBlack(filePath) {
  const image = sharp(filePath);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (r <= threshold && g <= threshold && b <= threshold) {
      data[i + 3] = 0;
    }
  }

  await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png({ compressionLevel: 9 })
    .toFile(`${filePath}.tmp`);

  fs.renameSync(`${filePath}.tmp`, filePath);
  console.log(`transparentized: ${path.basename(filePath)}`);
}

const files = fs.readdirSync(coffeeDir).filter((name) => name.endsWith('.png'));

for (const file of files) {
  await transparentizeBlack(path.join(coffeeDir, file));
}

console.log(`done: ${files.length} files`);
