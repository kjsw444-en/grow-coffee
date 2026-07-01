import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** 캐릭터 커피 마시기 영상 캐시 버전 — 교체 시 +1 */
export const COFFEE_VIDEO_VERSION = 13

/** 히든 커플 영상 캐시 버전 — 교체 시 +1 */
export const HIDDEN_VIDEO_VERSION = 5

const VIDEO_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public', 'videos')

export function getVideoAssetsDir() {
  return VIDEO_DIR
}

export function countVideoAssets() {
  if (!fs.existsSync(VIDEO_DIR)) {
    return 0
  }

  return fs.readdirSync(VIDEO_DIR).filter((fileName) => fileName.endsWith('.mp4')).length
}

export function buildCoffeeVideoPath(fileName, version) {
  return `/assets/videos/${fileName}?v=${version}`
}

export function getMediaAssetRules() {
  return {
    coffeeVideoVersion: COFFEE_VIDEO_VERSION,
    hiddenVideoVersion: HIDDEN_VIDEO_VERSION,
    videoCount: countVideoAssets(),
  }
}
