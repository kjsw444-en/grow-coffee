/**
 * 토스 iOS WebView용 mp4 재인코딩
 * H.264 baseline · AAC · yuv420p · faststart
 *
 * 사용: node scripts/transcode-coffee-videos-webview.mjs
 * 대상: 백엔드/public/videos + 프론트엔드/public/videos
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const videoDirs = [
  path.join(repoRoot, '백엔드', 'public', 'videos'),
  path.join(repoRoot, '프론트엔드', 'public', 'videos'),
].filter((dir) => fs.existsSync(dir));

function transcode(inputPath, outputPath) {
  const result = spawnSync(
    ffmpegPath,
    [
      '-y',
      '-i',
      inputPath,
      '-c:v',
      'libx264',
      '-profile:v',
      'baseline',
      '-level',
      '3.0',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      outputPath,
    ],
    { encoding: 'utf8' },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || `ffmpeg failed for ${inputPath}`);
  }
}

const primaryDir = videoDirs[0];
if (!primaryDir) {
  console.error('No video directory found. Expected 백엔드/public/videos');
  process.exit(1);
}

const files = fs
  .readdirSync(primaryDir)
  .filter((name) => name.startsWith('coffee-drink-') && name.endsWith('.mp4'))
  .sort();

if (files.length === 0) {
  console.error('No coffee-drink mp4 files found in', primaryDir);
  process.exit(1);
}

let totalBefore = 0;
let totalAfter = 0;

for (const name of files) {
  const inputPath = path.join(primaryDir, name);
  const tempPath = path.join(primaryDir, `${name}.webview.tmp.mp4`);
  const before = fs.statSync(inputPath).size;

  console.log(`\n[webview transcode] ${name}`);
  console.log(`  before: ${(before / 1024 / 1024).toFixed(2)} MB`);

  transcode(inputPath, tempPath);

  const after = fs.statSync(tempPath).size;
  fs.renameSync(tempPath, inputPath);

  for (const dir of videoDirs.slice(1)) {
    fs.copyFileSync(inputPath, path.join(dir, name));
  }

  totalBefore += before;
  totalAfter += after;
  console.log(`  after:  ${(after / 1024 / 1024).toFixed(2)} MB`);
}

console.log(`\nDone: ${files.length} files`);
console.log(`Total before: ${(totalBefore / 1024 / 1024).toFixed(2)} MB`);
console.log(`Total after:  ${(totalAfter / 1024 / 1024).toFixed(2)} MB`);
