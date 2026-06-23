/** 백엔드 mediaAssets.js 와 동기화 — 교체 시 양쪽 +1 */
export const COFFEE_VIDEO_VERSION = 9
export const HIDDEN_VIDEO_VERSION = 4

const VITE_DEV_PORTS = new Set(['5173', '5174', '4173'])

function resolveVideoApiBase(): string {
  const configured = import.meta.env.VITE_API_URL?.trim()
  if (configured) {
    return configured.replace(/\/$/, '')
  }

  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const { hostname, port } = window.location
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1'

    // Vite dev: /assets → vite proxy → 8787
    if (isLocalHost && VITE_DEV_PORTS.has(port)) {
      return ''
    }

    if (isLocalHost) {
      return 'http://127.0.0.1:8787'
    }
  }

  return ''
}

export function buildCoffeeVideoSrc(fileName: string, version: number) {
  const path = `/assets/videos/${fileName}?v=${version}`
  const base = resolveVideoApiBase()

  if (base) {
    return `${base}${path}`
  }

  return path
}
