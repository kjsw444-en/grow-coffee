import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const videoDir = path.join(repoRoot, '백엔드', 'public', 'videos');
const ffprobePath = ffprobeStatic.path;

function probe(filePath) {
  const result = spawnSync(
    ffprobePath,
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'csv=p=0:s=x',
      filePath,
    ],
    { encoding: 'utf8' },
  );
  return result.stdout.trim();
}

function transcode(inputPath, outputPath) {
  const result = spawnSync(
    ffmpegPath,
    [
      '-y',
      '-i',
      inputPath,
      '-vf',
      'scale=-2:720',
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '20',
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

const files = fs
  .readdirSync(videoDir)
  .filter((name) => name.startsWith('coffee-drink-') && name.endsWith('.mp4'))
  .sort();

if (files.length === 0) {
  console.error('No coffee-drink mp4 files found.');
  process.exit(1);
}

let totalBefore = 0;
let totalAfter = 0;

for (const name of files) {
  const inputPath = path.join(videoDir, name);
  const tempPath = path.join(videoDir, `${name}.720p.tmp.mp4`);
  const before = fs.statSync(inputPath).size;
  const beforeDims = probe(inputPath);

  console.log(`\n[transcode] ${name}`);
  console.log(`  before: ${beforeDims} ${(before / 1024 / 1024).toFixed(2)} MB`);

  transcode(inputPath, tempPath);

  const after = fs.statSync(tempPath).size;
  const afterDims = probe(tempPath);
  fs.renameSync(tempPath, inputPath);

  totalBefore += before;
  totalAfter += after;
  console.log(`  after:  ${afterDims} ${(after / 1024 / 1024).toFixed(2)} MB`);
}

console.log(`\nDone: ${files.length} files`);
console.log(`Total before: ${(totalBefore / 1024 / 1024).toFixed(2)} MB`);
console.log(`Total after:  ${(totalAfter / 1024 / 1024).toFixed(2)} MB`);
