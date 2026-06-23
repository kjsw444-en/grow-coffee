import { getApiBase } from './api'

/** 백엔드 mediaAssets.js 와 동기화 — 교체 시 양쪽 +1 */
export const COFFEE_VIDEO_VERSION = 9
export const HIDDEN_VIDEO_VERSION = 4

export function buildCoffeeVideoSrc(fileName: string, version: number) {
  const path = `/assets/videos/${fileName}?v=${version}`
  const base = getApiBase()

  if (base) {
    return `${base}${path}`
  }

  return path
}
