import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ForwardedRef,
} from 'react';
import type { CoffeeVariantSlug } from '../game/coffeeVariants';
import {
  attachVideoToDisplayHost,
  guardInlinePresentation,
  prepareDrinkVideoFirstFramePreview,
  prepareDrinkVideoForAudiblePlay,
} from '../game/drinkVideoCanvas';
import {
  claimPreparedVideoForDisplay,
  getDrinkVideoPrepSnapshot,
  markCoffeeVideoBuffered,
  prepareCoffeePlaybackVideo,
  releaseDisplayedVideoToPreload,
  resetDrinkVideoPrep,
  subscribeDrinkVideoPrep,
  type DrinkVideoPrepState,
} from '../game/drinkVideoPreparation';
import {
  getActiveCoffeePlayback,
  getNextCoffeePlaybackFallback,
  preloadCoffeePlayback,
  type CoffeePlayback,
  type SelectedCoffeeSlug,
} from '../game/hiddenCoffeeVariants';
import { isDrinkStage } from '../game/utils';

export type PlantDrinkVideoHandle = {
  playFromUserGesture: () => boolean;
};

type PlantDrinkVideoLayerProps = {
  active: boolean;
  mounted?: boolean;
  showPoster?: boolean;
  plantGrowth: number;
  selectedCoffeeVariant: SelectedCoffeeSlug;
  ownedCoffeeVariants: CoffeeVariantSlug[];
  onPlaybackStarted?: () => void;
  onPlaybackEnded?: () => void;
  onPlaybackFailed?: () => void;
};

const PLAYBACK_BUFFER_MARK_SEC = 0.05;
const PLAY_START_TIMEOUT_MS = 8_000;

function restoreAudiblePlayback(video: HTMLVideoElement) {
  video.muted = false;
  video.defaultMuted = false;
  video.volume = 1;
  video.removeAttribute('muted');
}

function PlantDrinkVideoLayerComponent(
  {
    active,
    mounted = active,
    showPoster = true,
    plantGrowth,
    selectedCoffeeVariant,
    ownedCoffeeVariants,
    onPlaybackStarted,
    onPlaybackEnded,
    onPlaybackFailed,
  }: PlantDrinkVideoLayerProps,
  ref: ForwardedRef<PlantDrinkVideoHandle>,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mountedVideoRef = useRef<HTMLVideoElement | null>(null);
  const mountedNetworkSrcRef = useRef<string | null>(null);
  const mountedDirectVideoRef = useRef(false);
  const markedBufferedRef = useRef(false);
  const isPlayingRef = useRef(false);
  const playRequestedRef = useRef(false);
  const playStartTimeoutRef = useRef<number | null>(null);
  const detachVideoListenersRef = useRef<(() => void) | null>(null);

  const onPlaybackStartedRef = useRef(onPlaybackStarted);
  const onPlaybackEndedRef = useRef(onPlaybackEnded);
  const onPlaybackFailedRef = useRef(onPlaybackFailed);
  onPlaybackStartedRef.current = onPlaybackStarted;
  onPlaybackEndedRef.current = onPlaybackEnded;
  onPlaybackFailedRef.current = onPlaybackFailed;

  const [blockedVideoSlugs, setBlockedVideoSlugs] = useState<SelectedCoffeeSlug[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playRequested, setPlayRequested] = useState(false);
  const [prepState, setPrepState] = useState<DrinkVideoPrepState>('idle');
  const [playFailed, setPlayFailed] = useState(false);

  const showCoffeeVariant = isDrinkStage(plantGrowth) || plantGrowth >= 75;
  const storedPlayback = useMemo((): CoffeePlayback | null => {
    if (!showCoffeeVariant) return null;
    return getActiveCoffeePlayback(plantGrowth, selectedCoffeeVariant, ownedCoffeeVariants);
  }, [showCoffeeVariant, plantGrowth, selectedCoffeeVariant, ownedCoffeeVariants]);

  const playback: CoffeePlayback | null = storedPlayback
    ? blockedVideoSlugs.includes(storedPlayback.id)
      ? getNextCoffeePlaybackFallback(storedPlayback, blockedVideoSlugs, ownedCoffeeVariants) ??
        storedPlayback
      : storedPlayback
    : null;

  const networkVideoSrc = playback?.video ?? null;
  const posterSrc = playback?.drinkPreviewImage ?? null;
  const prepReady = prepState === 'ready';
  const prepFailed = prepState === 'failed' || (playRequested && playFailed && !isPlaying);
  const showLoadingMessage = active && playRequested && !isPlaying && !prepReady && prepState !== 'failed';
  const showRetry = playRequested && prepFailed;
  const showStatusOverlay = active && playRequested && (showLoadingMessage || showRetry);
  const showPosterImage = showPoster && active && !!posterSrc && !isPlaying;

  const syncPrepState = useCallback(() => {
    if (!networkVideoSrc) {
      setPrepState('idle');
      return;
    }
    setPrepState(getDrinkVideoPrepSnapshot(networkVideoSrc).state);
  }, [networkVideoSrc]);

  const clearPlayStartTimeout = useCallback(() => {
    if (playStartTimeoutRef.current === null) return;
    window.clearTimeout(playStartTimeoutRef.current);
    playStartTimeoutRef.current = null;
  }, []);

  const releaseMountedVideo = useCallback(() => {
    detachVideoListenersRef.current?.();
    detachVideoListenersRef.current = null;
    const mountedVideo = mountedVideoRef.current;
    if (mountedNetworkSrcRef.current) {
      if (mountedDirectVideoRef.current) {
        mountedVideo?.pause();
        mountedVideo?.removeAttribute('src');
        mountedVideo?.load();
        mountedVideo?.remove();
      } else {
        releaseDisplayedVideoToPreload(mountedNetworkSrcRef.current);
      }
      mountedNetworkSrcRef.current = null;
    }
    mountedVideoRef.current = null;
    mountedDirectVideoRef.current = false;
    isPlayingRef.current = false;
    setIsPlaying(false);
    setPlayRequested(false);
    playRequestedRef.current = false;
  }, []);

  const ensureVideoMounted = useCallback((): HTMLVideoElement | null => {
    if (!networkVideoSrc) return null;

    const host = hostRef.current;
    if (!host) return null;

    if (
      mountedVideoRef.current &&
      mountedNetworkSrcRef.current === networkVideoSrc &&
      host.contains(mountedVideoRef.current)
    ) {
      return mountedVideoRef.current;
    }

    if (mountedNetworkSrcRef.current && mountedNetworkSrcRef.current !== networkVideoSrc) {
      releaseMountedVideo();
    }

    const preparedVideo = prepState === 'ready' ? claimPreparedVideoForDisplay(networkVideoSrc, host) : null;
    const video = preparedVideo ?? document.createElement('video');
    if (!preparedVideo) {
      video.crossOrigin = 'anonymous';
      video.src = networkVideoSrc;
      attachVideoToDisplayHost(video, host);
      video.load();
    }

    mountedVideoRef.current = video;
    mountedNetworkSrcRef.current = networkVideoSrc;
    mountedDirectVideoRef.current = !preparedVideo;
    markedBufferedRef.current = false;

    const releaseInlineGuard = guardInlinePresentation(video);

    const onPlaying = () => {
      clearPlayStartTimeout();
      isPlayingRef.current = true;
      playRequestedRef.current = false;
      setIsPlaying(true);
      setPlayFailed(false);
      restoreAudiblePlayback(video);
      onPlaybackStartedRef.current?.();
    };

    const onPause = () => {
      if (playRequestedRef.current && !video.ended) {
        console.log('[drink-video] pause-ignored-before-playing', {
          currentTime: video.currentTime,
          readyState: video.readyState,
          networkState: video.networkState,
        });
        return;
      }
      if (!video.ended) {
        isPlayingRef.current = false;
        setIsPlaying(false);
      }
    };

    const onEnded = () => {
      clearPlayStartTimeout();
      isPlayingRef.current = false;
      playRequestedRef.current = false;
      setIsPlaying(false);
      onPlaybackEndedRef.current?.();
    };

    const onDisplayReady = (eventName: string) => {
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      setPrepState('ready');
      console.log(`[drink-video] display-${eventName}`, {
        networkSrc: networkVideoSrc,
        readyState: video.readyState,
        networkState: video.networkState,
        currentSrc: video.currentSrc,
        clientWidth: video.clientWidth,
        clientHeight: video.clientHeight,
      });
    };

    const onLoadedData = () => onDisplayReady('loadeddata');
    const onCanPlay = () => onDisplayReady('canplay');

    const onTimeUpdate = () => {
      if (!video.paused && video.currentTime >= PLAYBACK_BUFFER_MARK_SEC && !markedBufferedRef.current) {
        markedBufferedRef.current = true;
        markCoffeeVideoBuffered(networkVideoSrc);
      }
    };

    const onError = () => {
      clearPlayStartTimeout();
      if (playback) {
        setBlockedVideoSlugs((prev) => {
          if (prev.includes(playback.id)) return prev;
          const next = [...prev, playback.id];
          const fallback = getNextCoffeePlaybackFallback(playback, next, ownedCoffeeVariants);
          if (fallback) preloadCoffeePlayback(fallback);
          return next;
        });
      }
      isPlayingRef.current = false;
      playRequestedRef.current = false;
      setIsPlaying(false);
      setPlayFailed(true);
      onPlaybackFailedRef.current?.();
      console.error('[drink-video] playback-error', {
        networkSrc: networkVideoSrc,
        error: video.error,
        readyState: video.readyState,
        networkState: video.networkState,
      });
    };

    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('error', onError);

    detachVideoListenersRef.current = () => {
      releaseInlineGuard();
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('error', onError);
    };

    return video;
  }, [clearPlayStartTimeout, networkVideoSrc, ownedCoffeeVariants, playback, prepState, releaseMountedVideo]);

  const logPlayFailed = useCallback((video: HTMLVideoElement, error: unknown) => {
    clearPlayStartTimeout();
    const err = error as { name?: string; message?: string; code?: number } | null;
    console.error('[drink-video play-failed]', {
      name: err?.name,
      message: err?.message,
      code: err?.code,
      currentSrc: video.currentSrc,
      readyState: video.readyState,
      networkState: video.networkState,
      error: video.error,
    });
    isPlayingRef.current = false;
    playRequestedRef.current = false;
    setIsPlaying(false);
    setPlayFailed(true);
    onPlaybackFailedRef.current?.();
  }, [clearPlayStartTimeout]);

  const playFromUserGesture = useCallback((): boolean => {
    if (!networkVideoSrc) {
      console.log('[drink-video] gesture-play-skipped', { networkVideoSrc });
      return false;
    }

    const video = ensureVideoMounted();
    if (!video) {
      console.log('[drink-video] gesture-play-skipped', {
        hasVideo: false,
        networkVideoSrc,
        prepState,
      });
      setPlayRequested(true);
      setPlayFailed(true);
      onPlaybackFailedRef.current?.();
      return false;
    }

    if (isPlayingRef.current && !video.paused) {
      return true;
    }

    setPlayRequested(true);
    playRequestedRef.current = true;
    setPlayFailed(false);
    isPlayingRef.current = true;
    setIsPlaying(true);

    console.log('[drink-video play]', {
      currentSrc: video.currentSrc,
      readyState: video.readyState,
      networkState: video.networkState,
      currentTime: video.currentTime,
      paused: video.paused,
      ended: video.ended,
      muted: video.muted,
      volume: video.volume,
      controls: video.controls,
      playsInline: video.playsInline,
      error: video.error,
    });

    try {
      prepareDrinkVideoForAudiblePlay(video);
      video.muted = true;
      video.defaultMuted = true;
      video.setAttribute('muted', '');
      clearPlayStartTimeout();
      playStartTimeoutRef.current = window.setTimeout(() => {
        if (!playRequestedRef.current || isPlayingRef.current && !video.paused) return;
        logPlayFailed(video, new Error('play start timeout'));
      }, PLAY_START_TIMEOUT_MS);
      const playPromise = video.play();
      playPromise
        .then(() => {
          window.setTimeout(() => {
            if (!video.paused && !video.ended) restoreAudiblePlayback(video);
          }, 80);
        })
        .catch((error) => logPlayFailed(video, error));
      return true;
    } catch (error) {
      logPlayFailed(video, error);
      return false;
    }
  }, [ensureVideoMounted, logPlayFailed, networkVideoSrc, prepState]);

  const handleRetry = useCallback(() => {
    if (!networkVideoSrc) return;
    setPlayFailed(false);
    playFromUserGesture();
  }, [networkVideoSrc, playFromUserGesture]);

  useImperativeHandle(ref, () => ({ playFromUserGesture }), [playFromUserGesture]);

  useEffect(() => subscribeDrinkVideoPrep(syncPrepState), [syncPrepState]);

  useEffect(() => {
    if (!networkVideoSrc) return;
    void prepareCoffeePlaybackVideo({ video: networkVideoSrc });
  }, [networkVideoSrc]);

  useEffect(() => {
    if (!mounted || !networkVideoSrc) return;
    ensureVideoMounted();
  }, [ensureVideoMounted, mounted, networkVideoSrc]);

  useEffect(() => {
    if (!active || prepState !== 'ready' || !networkVideoSrc) return;

    const video = ensureVideoMounted();
    if (!video || isPlayingRef.current) return;

    prepareDrinkVideoFirstFramePreview(video);
  }, [active, ensureVideoMounted, networkVideoSrc, prepState]);

  useEffect(() => {
    if (!active || !playRequested || prepState !== 'ready' || !networkVideoSrc) return;
    ensureVideoMounted();
  }, [active, ensureVideoMounted, networkVideoSrc, playRequested, prepState]);

  useEffect(() => {
    if (mounted) return;
    markedBufferedRef.current = false;
    playRequestedRef.current = false;
    setPlayRequested(false);
    setPlayFailed(false);
    setIsPlaying(false);
    releaseMountedVideo();
  }, [mounted, releaseMountedVideo]);

  useEffect(() => () => releaseMountedVideo(), [releaseMountedVideo]);

  useEffect(() => {
    return () => {
      if (networkVideoSrc) resetDrinkVideoPrep(networkVideoSrc);
    };
  }, [networkVideoSrc]);

  const layerClassName = [
    'plant-scene__drink-media',
    showPoster ? 'plant-scene__drink-media--solo' : '',
    mounted && !active ? 'plant-scene__drink-media--warmup' : '',
    'drink-video-layer',
    showPoster ? '' : 'drink-video-layer--warmup-only',
    isPlaying ? 'drink-video-layer--playing' : 'drink-video-layer--poster-front',
    prepReady ? 'drink-video-layer--video-ready' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (!mounted) {
    return null;
  }

  return (
    <div
      ref={hostRef}
      className={layerClassName}
      aria-busy={showLoadingMessage}
      aria-hidden={!isPlaying && !showPosterImage && !showStatusOverlay}
      aria-label="커피마시기"
    >
      {showPosterImage ? (
        <img
          className="plant-scene__drink-fallback__poster"
          src={posterSrc ?? undefined}
          alt=""
          draggable={false}
        />
      ) : null}
      {showStatusOverlay ? (
        <div className="plant-scene__drink-fallback plant-scene__drink-fallback--status-only">
          <div className="plant-scene__drink-fallback__overlay plant-scene__drink-fallback__overlay--status-only">
            {showLoadingMessage ? (
              <p className="plant-scene__drink-fallback__message">영상 준비 중…</p>
            ) : null}
            {showRetry ? (
              <>
                <p className="plant-scene__drink-fallback__message">영상을 재생할 수 없어요</p>
                <button
                  type="button"
                  className="plant-scene__drink-fallback__retry"
                  onClick={handleRetry}
                >
                  다시 시도
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const PlantDrinkVideoLayer = memo(forwardRef(PlantDrinkVideoLayerComponent));
