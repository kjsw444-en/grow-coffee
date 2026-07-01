/** iOS WebView — cross-origin mp4 autoplay 차단 우회용 blob 캐시 */

const blobUrlByNetworkSrc = new Map<string, string>();
const inflightByNetworkSrc = new Map<string, Promise<string | null>>();
const bufferedNetworkSrc = new Set<string>();

const BLOB_FETCH_TIMEOUT_MS = 15_000;

export function markCoffeeVideoBlobBuffered(networkSrc: string) {
  bufferedNetworkSrc.add(networkSrc);
}

export function isCoffeeVideoBlobBuffered(networkSrc: string): boolean {
  return bufferedNetworkSrc.has(networkSrc) || blobUrlByNetworkSrc.has(networkSrc);
}

export function isCoffeeVideoUsingBlob(networkSrc: string): boolean {
  return blobUrlByNetworkSrc.has(networkSrc);
}

export function resolveCoffeeVideoPlaybackSrc(networkSrc: string): string {
  return blobUrlByNetworkSrc.get(networkSrc) ?? networkSrc;
}

function logBlobFetch(
  tag: string,
  networkSrc: string,
  details: Record<string, unknown>,
) {
  console.log(`[drink-video] blob-${tag}`, { networkSrc, ...details });
}

export function preloadCoffeeVideoBlob(networkSrc: string): Promise<string | null> {
  const cached = blobUrlByNetworkSrc.get(networkSrc);
  if (cached) {
    markCoffeeVideoBlobBuffered(networkSrc);
    logBlobFetch('cache-hit', networkSrc, { playbackSrc: cached, hasBlob: true });
    return Promise.resolve(cached);
  }

  const inflight = inflightByNetworkSrc.get(networkSrc);
  if (inflight) return inflight;

  const task = (async () => {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), BLOB_FETCH_TIMEOUT_MS);
    let timedOut = false;

    try {
      const response = await fetch(networkSrc, { signal: controller.signal });
      logBlobFetch('response', networkSrc, {
        httpStatus: response.status,
        ok: response.ok,
        elapsedMs: Date.now() - startedAt,
      });

      if (!response.ok) {
        logBlobFetch('http-failed', networkSrc, {
          httpStatus: response.status,
          usedFallbackUrl: true,
        });
        return null;
      }

      const blob = await response.blob();
      if (!blob.size) {
        logBlobFetch('empty-blob', networkSrc, { usedFallbackUrl: true });
        return null;
      }

      const blobUrl = URL.createObjectURL(blob);
      blobUrlByNetworkSrc.set(networkSrc, blobUrl);
      markCoffeeVideoBlobBuffered(networkSrc);
      logBlobFetch('ready', networkSrc, {
        playbackSrc: blobUrl,
        hasBlob: true,
        blobBytes: blob.size,
        elapsedMs: Date.now() - startedAt,
      });
      return blobUrl;
    } catch (error) {
      timedOut = error instanceof DOMException && error.name === 'AbortError';
      console.error('[drink-video] blob-fetch-failed', {
        networkSrc,
        timedOut,
        usedFallbackUrl: true,
        error,
        elapsedMs: Date.now() - startedAt,
      });
      return null;
    } finally {
      window.clearTimeout(timeoutId);
      inflightByNetworkSrc.delete(networkSrc);
      if (timedOut) {
        logBlobFetch('timeout', networkSrc, {
          timeoutMs: BLOB_FETCH_TIMEOUT_MS,
          usedFallbackUrl: true,
        });
      }
    }
  })();

  inflightByNetworkSrc.set(networkSrc, task);
  return task;
}
