import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const DRINK_PREVIEW_WIDTH = 473;
const DRINK_PREVIEW_HEIGHT = 1024;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(
  'C:/Users/USER/.cursor/projects/c-Users-USER-Projects-grow-coffee/assets',
);
const outDir = path.join(__dirname, '../public/images/drink-preview');

/** slug → assets 파일명(UUID 포함) */
const DRINK_PREVIEW_SOURCES = {
  'parttime-latte':
    'c__Users_USER_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_______________-aa99d11f-4eff-4345-b78a-f51be35d5d66.png',
  'student-coldbrew':
    'c__Users_USER_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_______________-3ee8c413-0d2c-4f64-a9e2-1de353542ea9.png',
  'blonde-hazelnut':
    'c__Users_USER_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images__________________-20a1cc93-1270-4af5-b3f7-5d92b1a43fc7.png',
  'dolce-latte':
    'c__Users_USER_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images________________-f43bbce5-dee6-4590-a61d-cece3163c0d0.png',
  'sexy-americano':
    'c__Users_USER_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images________________-040c0c11-e7e7-47dc-9baf-8c5b52dd5556.png',
  'chic-vanilla-latte':
    'c__Users_USER_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images________________-0635ea16-af22-4823-8e2c-220ba21f1391.png',
  'm-parttime-latte':
    'c__Users_USER_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images______________-d92d7ba8-c8c4-4656-9937-46cf45027a97.png',
  'm-student-coldbrew':
    'c__Users_USER_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images______________-cbf2885d-e5a4-4a6e-85b5-27acd9e1fbd5.png',
  'm-blonde-hazelnut':
    'c__Users_USER_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images______________-049b065a-1697-49b0-8cc0-de8dcbeddcc2.png',
  'm-dolce-latte':
    'c__Users_USER_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images______________-bca17ec8-c677-409f-bb9e-f5715fc59269.png',
  'm-sexy-americano':
    'c__Users_USER_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images________________-bd59d2e2-ad3f-4746-97c2-630f13b92e21.png',
  'm-chic-vanilla-latte':
    'c__Users_USER_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_______________-e0857355-1677-4088-9654-2ff836e0c7d8.png',
  'hidden-hazelnut-m-cafe-latte-f':
    'c__Users_USER_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images____________________-f3bf34e0-90f6-4be4-a279-24348f4d3f31.png',
  'hidden-cafe-latte-m-hazelnut-f':
    'c__Users_USER_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images____________________-65cacd18-0eb9-4e33-b527-562808fc0011.png',
  'hidden-dolce-m-americano-f':
    'c__Users_USER_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_____________________-74760a01-e64b-40e3-a4cf-72148701e1d0.png',
  'hidden-dolce-m-dolce-f':
    'c__Users_USER_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images________-35581f65-679e-40e0-8f15-edac34ba2d45.png',
  'hidden-vanilla-m-dolce-f':
    'c__Users_USER_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images____________________-d4a61d38-6c6c-4cf8-b22e-efa163f96f3d.png',
  'hidden-americano-m-vanilla-f':
    'c__Users_USER_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images___________________-84092e96-21b7-4d03-8cac-6c3e7c229a4d.png',
};

async function writeNormalizedPng(inputPath, destPath) {
  const tempPath = `${destPath}.tmp`;
  await sharp(inputPath)
    .resize(DRINK_PREVIEW_WIDTH, DRINK_PREVIEW_HEIGHT, {
      fit: 'cover',
      position: 'centre',
    })
    .png()
    .toFile(tempPath);
  fs.renameSync(tempPath, destPath);
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  let installed = 0;
  for (const [slug, fileName] of Object.entries(DRINK_PREVIEW_SOURCES)) {
    const src = path.join(assetsDir, fileName);
    const dest = path.join(outDir, `${slug}.png`);
    if (!fs.existsSync(src)) {
      console.error(`missing source for ${slug}: ${fileName}`);
      process.exitCode = 1;
      continue;
    }
    await writeNormalizedPng(src, dest);
    console.log(`installed ${slug}.png (${DRINK_PREVIEW_WIDTH}x${DRINK_PREVIEW_HEIGHT})`);
    installed += 1;
  }

  console.log(`done: ${installed}/${Object.keys(DRINK_PREVIEW_SOURCES).length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
