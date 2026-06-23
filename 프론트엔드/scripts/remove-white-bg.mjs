import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function isBackgroundWhite(data, pixelIndex) {
  const r = data[pixelIndex];
  const g = data[pixelIndex + 1];
  const b = data[pixelIndex + 2];
  const brightness = (r + g + b) / 3;
  const saturation = Math.max(r, g, b) - Math.min(r, g, b);
  return brightness >= 248 && saturation <= 20;
}

function isHoleWhite(data, pixelIndex) {
  const r = data[pixelIndex];
  const g = data[pixelIndex + 1];
  const b = data[pixelIndex + 2];
  const brightness = (r + g + b) / 3;
  const saturation = Math.max(r, g, b) - Math.min(r, g, b);
  return brightness >= 243 && saturation <= 18;
}

/** 가장자리와 연결된 흰 배경만 투명 처리 */
function floodRemoveBorderWhite(data, width, height) {
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = [];

  const tryPush = (idx) => {
    if (idx < 0 || idx >= total || visited[idx]) return;
    if (!isBackgroundWhite(data, idx * 4)) return;
    visited[idx] = 1;
    queue.push(idx);
  };

  for (let x = 0; x < width; x += 1) {
    tryPush(x);
    tryPush((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    tryPush(y * width);
    tryPush(y * width + (width - 1));
  }

  while (queue.length > 0) {
    const idx = queue.pop();
    const x = idx % width;
    const y = (idx / width) | 0;
    if (x > 0) tryPush(idx - 1);
    if (x < width - 1) tryPush(idx + 1);
    if (y > 0) tryPush(idx - width);
    if (y < height - 1) tryPush(idx + width);
  }

  for (let idx = 0; idx < total; idx += 1) {
    if (visited[idx]) data[idx * 4 + 3] = 0;
  }

  return visited;
}

/** 손잡i 구멍(우상단) — 가장자리와 연결되지 않은 흰 영역만 투명 처리 */
function removeEnclosedWhite(data, width, height, borderVisited) {
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = [];

  for (let idx = 0; idx < total; idx += 1) {
    if (borderVisited[idx] || visited[idx] || data[idx * 4 + 3] <= 8) continue;
    if (!isHoleWhite(data, idx * 4)) continue;

    queue.length = 0;
    queue.push(idx);
    visited[idx] = 1;
    const component = [idx];
    let minX = idx % width;
    let maxX = minX;
    let minY = (idx / width) | 0;
    let maxY = minY;

    while (queue.length > 0) {
      const current = queue.pop();
      const x = current % width;
      const y = (current / width) | 0;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      const neighbors = [current - 1, current + 1, current - width, current + width];
      for (const next of neighbors) {
        if (next < 0 || next >= total || visited[next]) continue;
        const nx = next % width;
        const ny = (next / width) | 0;
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
        if (!isHoleWhite(data, next * 4)) continue;
        visited[next] = 1;
        queue.push(next);
        component.push(next);
      }
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const isHandleHole =
      component.length >= 500 &&
      centerX >= width * 0.68 &&
      centerY <= height * 0.45;

    if (!isHandleHole) continue;

    for (const holeIdx of component) {
      data[holeIdx * 4 + 3] = 0;
    }
  }
}

async function processWateringCan(inputPath, outputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const borderVisited = floodRemoveBorderWhite(data, info.width, info.height);
  removeEnclosedWhite(data, info.width, info.height, borderVisited);

  const tmp = `${outputPath}.tmp`;
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 1 })
    .png({ compressionLevel: 9 })
    .toFile(tmp);

  fs.renameSync(tmp, outputPath);
  console.log(`processed: ${path.basename(outputPath)}`);
}

const source =
  process.argv[2] ??
  'C:/Users/USER/.cursor/projects/c-Users-USER-Projects-grow-coffee/assets/c__Users_USER_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_____-a1c8a175-49d7-4053-ad5c-70f49f553821.png';
const target =
  process.argv[3] ??
  path.join(__dirname, '../public/images/plant/watering-can.png');

await processWateringCan(path.resolve(source), path.resolve(target));
