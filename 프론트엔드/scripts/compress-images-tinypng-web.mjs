import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const imageRoot = path.join(repoRoot, '프론트엔드', 'public');
const exts = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const maxBytes = 1024 * 1024;
const batchSize = 20;

function collectImages(dir) {
  const files = [];
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) files.push(...collectImages(full));
    else if (exts.has(path.extname(name.name).toLowerCase())) files.push(full);
  }
  return files.sort();
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function createPage(browser) {
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  );
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  return page;
}

async function compressBatch(browser, files) {
  const page = await createPage(browser);
  const processResults = [];

  page.on('response', async (res) => {
    if (!res.url().includes('/backend/opt/process')) return;
    const body = await res.text().catch(() => '');
    if (!body) return;
    try {
      const json = JSON.parse(body);
      if (json.url && json.size) processResults.push(json);
    } catch {}
  });

  await page.goto('https://tinypng.com/', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));

  const input = await page.$('input[type=file]');
  if (!input) throw new Error('TinyPNG file input not found');
  await input.uploadFile(...files);

  const started = Date.now();
  while (processResults.length < files.length && Date.now() - started < 180000) {
    await new Promise((r) => setTimeout(r, 1000));
  }
  await page.close();

  if (processResults.length < files.length) {
    throw new Error(`Only ${processResults.length}/${files.length} images were compressed`);
  }

  const output = [];
  for (let i = 0; i < files.length; i += 1) {
    const filePath = files[i];
    const result = processResults[i];
    const res = await fetch(result.url);
    if (!res.ok) throw new Error(`Download failed for ${path.basename(filePath)}: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    output.push({ filePath, buffer });
  }

  return output;
}

const images = collectImages(imageRoot);
const batches = chunk(images, batchSize);

console.log(`TinyPNG web compression: ${images.length} images in ${batches.length} batches`);

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
});

let totalBefore = 0;
let totalAfter = 0;
let changed = 0;

try {
  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    console.log(`\nBatch ${i + 1}/${batches.length} (${batch.length} files)`);

    let results;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        results = await compressBatch(browser, batch);
        break;
      } catch (error) {
        console.warn(`  attempt ${attempt} failed: ${error.message}`);
        if (attempt === 3) throw error;
        await new Promise((r) => setTimeout(r, 4000));
      }
    }

    for (const { filePath, buffer } of results) {
      const before = fs.statSync(filePath).size;
      const after = buffer.length;
      const rel = path.relative(repoRoot, filePath);
      totalBefore += before;

      if (after > maxBytes) {
        throw new Error(`${rel} is still ${(after / 1024 / 1024).toFixed(2)} MB after TinyPNG`);
      }

      if (after < before) {
        fs.writeFileSync(filePath, buffer);
        changed += 1;
        totalAfter += after;
        console.log(
          `  done ${rel}: ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB (-${Math.round((1 - after / before) * 100)}%)`,
        );
      } else {
        totalAfter += before;
        console.log(`  keep ${rel}: ${(before / 1024).toFixed(0)} KB`);
      }
    }
  }
} finally {
  await browser.close();
}

const remaining = images.filter((p) => fs.statSync(p).size > maxBytes);
console.log(`\nChanged: ${changed}/${images.length}`);
console.log(`Total: ${(totalBefore / 1024 / 1024).toFixed(2)} MB -> ${(totalAfter / 1024 / 1024).toFixed(2)} MB`);
console.log(`Still over 1MB: ${remaining.length}`);
if (remaining.length) process.exit(1);
