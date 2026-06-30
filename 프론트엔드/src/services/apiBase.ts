const VITE_DEV_PORTS = new Set(['5173', '5174', '4173']);

function getDevBackendBase() {
  return 'http://127.0.0.1:8787';
}

/** mediaAssets 등 순환 import 없이 API 베이스만 필요할 때 사용 */
export function getApiBase() {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const { hostname, port } = window.location;
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';

    // Vite dev(5173 등): 같은 출처 /api → vite proxy → 8787 (CORS·PNA 문제 없음)
    if (isLocalHost && VITE_DEV_PORTS.has(port)) {
      return '';
    }

    // Granite shell(8081) 등: 백엔드 직접 연결
    if (isLocalHost) {
      return getDevBackendBase();
    }
  }

  return '';
}

export function getApiBaseForDebug() {
  return getApiBase() || `${typeof window !== 'undefined' ? window.location.origin : ''}/api (proxy)`;
}
