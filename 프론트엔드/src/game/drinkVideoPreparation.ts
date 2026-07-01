import {
  attachVideoToDisplayHost,
  attachVideoToHost,
  configureHiddenPreloadVideo,
} from './drinkVideoCanvas';
import {
  isCoffeeVideoUsingBlob,
  preloadCoffeeVideoBlob,
  resolveCoffeeVideoPlaybackSrc,
} from './coffeeVideoBlobCache';
export type DrinkVideoSource = {
  video: string;
};

export type DrinkVideoPrepState = 'idle' | 'loading' | 'ready' | 'failed';

export type DrinkVideoPrepSnapshot = {
  networkSrc: string;
  playbackSrc: string | null;
  hasBlob: boolean;
  state: DrinkVideoPrepState;
  canplay: boolean;
  canplaythrough: boolean;
  playing: boolean;
  error: string | null;
};

type PrepRecord = {
  networkSrc: string;
  playbackSrc: string | null;
  hasBlob: boolean;
  state: DrinkVideoPrepState;
  video: HTMLVideoElement | null;
  canplay: boolean;
  canplaythrough: boolean;
  playing: boolean;
  error: string | null;
  preparePromise: Promise<void> | null;
  verifyPromise: Promise<void> | null;
};

const prepByNetworkSrc = new Map<string, PrepRecord>();
const bufferedNetworkSrc = new Set<string>();
const prepListeners = new Set<() => void>();

const CANPLAY_TIMEOUT_MS = 20_000;

function notifyPrepListeners() {
  prepListeners.forEach((listener) => listener());
}

function logDrinkVideo(tag: string, details: Record<string, unknown>) {
  console.log(`[drink-video] ${tag}`, details);
}

function getVideoDiagnostics(video: HTMLVideoElement) {
  return {
    currentSrc: video.currentSrc,
    readyState: video.readyState,
    networkState: video.networkState,
    error: video.error
      ? { code: video.error.code, message: video.error.message }
      : null,
    paused: video.paused,
    currentTime: video.currentTime,
  };
}

function getPreloadHost(): HTMLElement {
  if (typeof document === 'undefined') {
    throw new Error('document unavailable');
  }

  let host = document.getElementById('coffee-video-preload-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'coffee-video-preload-host';
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText =
      'position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;z-index:-1;';
    document.body.append(host);
  }
  return host;
}

function ensurePrepRecord(networkSrc: string): PrepRecord {
  const existing = prepByNetworkSrc.get(networkSrc);
  if (existing) return existing;

  const record: PrepRecord = {
    networkSrc,
    playbackSrc: null,
    hasBlob: false,
    state: 'idle',
    video: null,
    canplay: false,
    canplaythrough: false,
    playing: false,
    error: null,
    preparePromise: null,
    verifyPromise: null,
  };
  prepByNetworkSrc.set(networkSrc, record);
  return record;
}

async function resolvePlaybackSrc(networkSrc: string): Promise<{
  src: string;
  hasBlob: boolean;
  usedFallbackUrl: boolean;
}> {
  const cachedBlob = resolveCoffeeVideoPlaybackSrc(networkSrc);
  if (cachedBlob !== networkSrc) {
    logDrinkVideo('playback-src', {
      networkSrc,
      playbackSrc: cachedBlob,
      hasBlob: true,
      usedFallbackUrl: false,
    });
    return { src: cachedBlob, hasBlob: true, usedFallbackUrl: false };
  }

  const blobUrl = await preloadCoffeeVideoBlob(networkSrc);
  if (blobUrl && blobUrl !== networkSrc) {
    logDrinkVideo('playback-src', {
      networkSrc,
      playbackSrc: blobUrl,
      hasBlob: true,
      usedFallbackUrl: false,
    });
    return { src: blobUrl, hasBlob: true, usedFallbackUrl: false };
  }

  logDrinkVideo('playback-src-fallback', {
    networkSrc,
    playbackSrc: networkSrc,
    hasBlob: false,
    usedFallbackUrl: true,
  });
  return { src: networkSrc, hasBlob: false, usedFallbackUrl: true };
}

function waitForVideoReady(
  video: HTMLVideoElement,
  networkSrc: string,
  record: PrepRecord,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      record.canplay = true;
      record.canplaythrough = true;
      resolve();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error(`canplay timeout (${CANPLAY_TIMEOUT_MS}ms)`));
    }, CANPLAY_TIMEOUT_MS);

    const onCanPlay = () => {
      record.canplay = true;
      logDrinkVideo('canplay', {
        networkSrc,
        ...getVideoDiagnostics(video),
      });
      if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        cleanup();
        resolve();
      }
    };

    const onCanPlayThrough = () => {
      record.canplaythrough = true;
      logDrinkVideo('canplaythrough', {
        networkSrc,
        ...getVideoDiagnostics(video),
      });
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      const message = video.error?.message ?? 'video error during preload';
      reject(new Error(message));
    };

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('canplaythrough', onCanPlayThrough);
      video.removeEventListener('loadeddata', onCanPlay);
      video.removeEventListener('error', onError);
    };

    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('canplaythrough', onCanPlayThrough, { once: true });
    video.addEventListener('loadeddata', onCanPlay);
    video.addEventListener('error', onError, { once: true });
  });
}

function attachPrepEventListeners(video: HTMLVideoElement, record: PrepRecord) {
  const onPlaying = () => {
    record.playing = true;
    logDrinkVideo('playing', {
      networkSrc: record.networkSrc,
      ...getVideoDiagnostics(video),
    });
    notifyPrepListeners();
  };

  video.addEventListener('playing', onPlaying);
  return () => {
    video.removeEventListener('playing', onPlaying);
  };
}

export function subscribeDrinkVideoPrep(listener: () => void) {
  prepListeners.add(listener);
  return () => {
    prepListeners.delete(listener);
  };
}

export function getDrinkVideoPrepSnapshot(networkSrc: string): DrinkVideoPrepSnapshot {
  const record = prepByNetworkSrc.get(networkSrc);
  if (!record) {
    return {
      networkSrc,
      playbackSrc: null,
      hasBlob: isCoffeeVideoUsingBlob(networkSrc),
      state: 'idle',
      canplay: false,
      canplaythrough: false,
      playing: false,
      error: null,
    };
  }

  return {
    networkSrc: record.networkSrc,
    playbackSrc: record.playbackSrc,
    hasBlob: record.hasBlob,
    state: record.state,
    canplay: record.canplay,
    canplaythrough: record.canplaythrough,
    playing: record.playing,
    error: record.error,
  };
}

export function markCoffeeVideoBuffered(networkSrc: string) {
  bufferedNetworkSrc.add(networkSrc);
}

export function isCoffeeVideoBuffered(networkSrc: string): boolean {
  const record = prepByNetworkSrc.get(networkSrc);
  return (
    bufferedNetworkSrc.has(networkSrc) ||
    record?.state === 'ready' ||
    (record?.video != null &&
      record.video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA)
  );
}

export function isDrinkVideoReady(networkSrc: string): boolean {
  return prepByNetworkSrc.get(networkSrc)?.state === 'ready';
}

export function getPreparedDrinkVideo(networkSrc: string): HTMLVideoElement | null {
  const record = prepByNetworkSrc.get(networkSrc);
  if (!record?.video || record.state !== 'ready') return null;
  return record.video;
}

export function prepareCoffeePlaybackVideo(playback: DrinkVideoSource): Promise<void> {
  if (typeof document === 'undefined') {
    return Promise.resolve();
  }

  const networkSrc = playback.video;
  const record = ensurePrepRecord(networkSrc);

  if (record.state === 'ready' && record.video) {
    return Promise.resolve();
  }

  if (record.preparePromise) {
    return record.preparePromise;
  }

  record.state = 'loading';
  record.error = null;
  notifyPrepListeners();

  const task = (async () => {
    try {
      const { src, hasBlob } = await resolvePlaybackSrc(networkSrc);
      record.playbackSrc = src;
      record.hasBlob = hasBlob;

      if (!record.video) {
        const video = document.createElement('video');
        configureHiddenPreloadVideo(video);
        record.video = video;
        attachPrepEventListeners(video, record);
      }

      const video = record.video;
      attachVideoToHost(video, getPreloadHost());

      const needsLoad = video.src !== src && video.getAttribute('src') !== src;
      if (needsLoad) {
        video.src = src;
        video.load();
        logDrinkVideo('load', {
          networkSrc,
          playbackSrc: src,
          hasBlob,
          ...getVideoDiagnostics(video),
        });
      } else if (video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
        video.load();
        logDrinkVideo('reload', {
          networkSrc,
          playbackSrc: src,
          hasBlob,
          ...getVideoDiagnostics(video),
        });
      }

      await waitForVideoReady(video, networkSrc, record);
      record.state = 'ready';
      markCoffeeVideoBuffered(networkSrc);
      logDrinkVideo('prepare-ready', {
        networkSrc,
        playbackSrc: src,
        hasBlob,
        canplay: record.canplay,
        canplaythrough: record.canplaythrough,
        ...getVideoDiagnostics(video),
      });
    } catch (error) {
      record.state = 'failed';
      record.error = error instanceof Error ? error.message : String(error);
      console.error('[drink-video] prepare-failed', {
        networkSrc,
        playbackSrc: record.playbackSrc,
        hasBlob: record.hasBlob,
        error,
      });
    } finally {
      record.preparePromise = null;
      notifyPrepListeners();
    }
  })();

  record.preparePromise = task;
  return task;
}

/** 75% — 기존 video/canplay만 확인·재시도 (fetch·createElement 없음) */
export function verifyDrinkVideoPrepReady(networkSrc: string): Promise<void> {
  if (typeof document === 'undefined') {
    return Promise.resolve();
  }

  const record = prepByNetworkSrc.get(networkSrc);
  if (!record) {
    logDrinkVideo('verify-skipped', { networkSrc, reason: 'no-record' });
    return Promise.resolve();
  }

  if (record.preparePromise) {
    return record.preparePromise;
  }

  const video = record.video;
  if (
    record.state === 'ready' &&
    video &&
    video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA &&
    record.canplay
  ) {
    logDrinkVideo('verify-ok', {
      networkSrc,
      canplay: record.canplay,
      canplaythrough: record.canplaythrough,
      ...getVideoDiagnostics(video),
    });
    return Promise.resolve();
  }

  if (!video || !record.playbackSrc) {
    logDrinkVideo('verify-skipped', {
      networkSrc,
      reason: 'no-video-or-src',
      state: record.state,
    });
    return Promise.resolve();
  }

  if (record.verifyPromise) {
    return record.verifyPromise;
  }

  record.state = 'loading';
  notifyPrepListeners();

  const task = (async () => {
    try {
      attachVideoToHost(video, getPreloadHost());
      if (video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
        video.load();
        logDrinkVideo('verify-reload', {
          networkSrc,
          playbackSrc: record.playbackSrc,
          ...getVideoDiagnostics(video),
        });
      }
      await waitForVideoReady(video, networkSrc, record);
      record.state = 'ready';
      logDrinkVideo('verify-ready', {
        networkSrc,
        canplay: record.canplay,
        canplaythrough: record.canplaythrough,
        ...getVideoDiagnostics(video),
      });
    } catch (error) {
      record.state = 'failed';
      record.error = error instanceof Error ? error.message : String(error);
      console.error('[drink-video] verify-failed', {
        networkSrc,
        playbackSrc: record.playbackSrc,
        error,
      });
    } finally {
      record.verifyPromise = null;
      notifyPrepListeners();
    }
  })();

  record.verifyPromise = task;
  return task;
}

export function resetDrinkVideoPrep(networkSrc: string) {
  const record = prepByNetworkSrc.get(networkSrc);
  if (!record) return;

  if (record.video) {
    record.video.pause();
    record.video.removeAttribute('src');
    record.video.load();
    record.video.remove();
    record.video = null;
  }

  prepByNetworkSrc.delete(networkSrc);
  notifyPrepListeners();
}

export function claimPreparedVideoForDisplay(
  networkSrc: string,
  host: HTMLElement,
): HTMLVideoElement | null {
  const record = prepByNetworkSrc.get(networkSrc);
  if (!record?.video || record.state !== 'ready') {
    logDrinkVideo('claim-skipped', {
      networkSrc,
      state: record?.state ?? 'missing',
    });
    return null;
  }

  const video = record.video;

  if (!video.currentSrc && record.playbackSrc) {
    video.src = record.playbackSrc;
    logDrinkVideo('claim-restore-src', {
      networkSrc,
      playbackSrc: record.playbackSrc,
      hasBlob: record.hasBlob,
    });
  }

  attachVideoToDisplayHost(video, host);

  logDrinkVideo('claim', {
    networkSrc,
    playbackSrc: record.playbackSrc,
    hasBlob: record.hasBlob,
    blobAlive: record.hasBlob ? !!record.playbackSrc : null,
    ...getVideoDiagnostics(video),
  });

  logDrinkVideo('after-claim', {
    networkSrc,
    playbackSrc: record.playbackSrc,
    hasBlob: record.hasBlob,
    readyState: video.readyState,
    networkState: video.networkState,
    currentSrc: video.currentSrc,
    src: video.getAttribute('src'),
    clientWidth: video.clientWidth,
    clientHeight: video.clientHeight,
    error: video.error
      ? { code: video.error.code, message: video.error.message }
      : null,
  });

  return video;
}

export function releaseDisplayedVideoToPreload(networkSrc: string) {
  const record = prepByNetworkSrc.get(networkSrc);
  if (!record?.video) return;

  const video = record.video;
  video.pause();
  configureHiddenPreloadVideo(video);
  attachVideoToHost(video, getPreloadHost());
  record.playing = false;
  logDrinkVideo('release-to-preload', {
    networkSrc,
    playbackSrc: record.playbackSrc,
    hasBlob: record.hasBlob,
    blobRevoked: false,
    ...getVideoDiagnostics(video),
  });
  notifyPrepListeners();
}

export function logDrinkVideoPlayAttempt(
  tag: string,
  networkSrc: string,
  video: HTMLVideoElement,
  extra: Record<string, unknown> = {},
) {
  const record = prepByNetworkSrc.get(networkSrc);
  logDrinkVideo(tag, {
    networkSrc,
    hasBlob: record?.hasBlob ?? isCoffeeVideoUsingBlob(networkSrc),
    playbackSrc: record?.playbackSrc ?? resolveCoffeeVideoPlaybackSrc(networkSrc),
    canplay: record?.canplay ?? false,
    canplaythrough: record?.canplaythrough ?? false,
    playing: record?.playing ?? false,
    ...getVideoDiagnostics(video),
    ...extra,
  });
}
