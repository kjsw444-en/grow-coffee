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
import { useSound } from '../audio/SoundProvider';
import { COFFEE_COMPLETE_BG_SRC, DRINK_VIDEO_VOLUME } from '../game/constants';
import type { CoffeeVariantSlug } from '../game/coffeeVariants';
import {
  getActiveCoffeePlayback,
  getNextCoffeePlaybackFallback,
  preloadCoffeePlayback,
  type CoffeePlayback,
  type SelectedCoffeeSlug,
} from '../game/hiddenCoffeeVariants';
import {
  isCoffeeVideoBlobBuffered,
  resolveCoffeeVideoPlaybackSrc,
} from '../game/coffeeVideoBlobCache';
import { isDrinkStage } from '../game/utils';

export type PlantDrinkVideoHandle = {
  unmute: () => Promise<void>;
};

type PlantDrinkVideoLayerProps = {
  active: boolean;
  plantGrowth: number;
  selectedCoffeeVariant: SelectedCoffeeSlug;
  ownedCoffeeVariants: CoffeeVariantSlug[];
  fallbackBgSrc?: string;
  onPlaybackStarted?: () => void;
  onPlaybackEnded?: () => void;
  onPlaybackFailed?: () => void;
};

const DRINK_LOADING_LINES = [
  '곧 바리스타가 나와요…',
  '따뜻한 라떼 준비 중이에요 ☕',
  '조금만 기다려 주세요',
] as const;
const DRINK_LOADING_MESSAGE_DELAY_MS = 500;

function applyMountedVideoAttributes(video: HTMLVideoElement) {
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.removeAttribute('controls');
}

function applyMutedVideoAttributes(video: HTMLVideoElement) {
  applyMountedVideoAttributes(video);
  video.muted = true;
  video.defaultMuted = true;
  video.setAttribute('muted', '');
}

function applyAudibleVideoAttributes(video: HTMLVideoElement) {
  applyMountedVideoAttributes(video);
  video.muted = false;
  video.defaultMuted = false;
  video.removeAttribute('muted');
  video.volume = DRINK_VIDEO_VOLUME;
}

function PlantDrinkVideoLayerComponent(
  {
    active,
    plantGrowth,
    selectedCoffeeVariant,
    ownedCoffeeVariants,
    fallbackBgSrc = COFFEE_COMPLETE_BG_SRC,
    onPlaybackStarted,
    onPlaybackEnded,
    onPlaybackFailed,
  }: PlantDrinkVideoLayerProps,
  ref: ForwardedRef<PlantDrinkVideoHandle>,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wasActiveRef = useRef(false);
  const drinkVideoMutedRef = useRef(true);
  const drinkVideoStartedRef = useRef(false);
  const soundRequestedRef = useRef(false);
  const settledRef = useRef(false);
  const { unlock } = useSound();

  const onPlaybackStartedRef = useRef(onPlaybackStarted);
  const onPlaybackEndedRef = useRef(onPlaybackEnded);
  const onPlaybackFailedRef = useRef(onPlaybackFailed);
  onPlaybackStartedRef.current = onPlaybackStarted;
  onPlaybackEndedRef.current = onPlaybackEnded;
  onPlaybackFailedRef.current = onPlaybackFailed;

  const [blockedVideoSlugs, setBlockedVideoSlugs] = useState<SelectedCoffeeSlug[]>([]);
  const [videoReady, setVideoReady] = useState(false);
  const [showLoadingMessage, setShowLoadingMessage] = useState(false);
  const [loadingLineIndex, setLoadingLineIndex] = useState(0);

  const drinkStage = isDrinkStage(plantGrowth);
  const showCoffeeVariant = drinkStage || plantGrowth >= 75;
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

  const drinkVideoSrc = playback?.video ?? null;
  const playbackVideoSrc = drinkVideoSrc ? resolveCoffeeVideoPlaybackSrc(drinkVideoSrc) : null;
  const hasBufferedVideo = drinkVideoSrc ? isCoffeeVideoBlobBuffered(drinkVideoSrc) : false;
  const loadingLine = DRINK_LOADING_LINES[loadingLineIndex % DRINK_LOADING_LINES.length];

  const settlePlayback = useCallback(
    (kind: 'ended' | 'failed') => {
      if (settledRef.current) return;
      settledRef.current = true;

      if (kind === 'ended') {
        onPlaybackEndedRef.current?.();
        return;
      }

      console.warn('[drink-video] playback-settled-failed', {
        src: drinkVideoSrc,
      });
      onPlaybackFailedRef.current?.();
    },
    [drinkVideoSrc],
  );

  useEffect(() => {
    if (!storedPlayback) return;
    preloadCoffeePlayback(storedPlayback);
  }, [storedPlayback]);

  useEffect(() => {
    if (!playback || playback.id === storedPlayback?.id) return;
    preloadCoffeePlayback(playback);
  }, [playback, storedPlayback?.id]);

  useEffect(() => {
    setVideoReady(false);
    setShowLoadingMessage(false);
    setLoadingLineIndex(0);
    settledRef.current = false;
  }, [drinkVideoSrc, active]);

  useEffect(() => {
    if (!active || videoReady || hasBufferedVideo) {
      setShowLoadingMessage(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setShowLoadingMessage(true);
    }, DRINK_LOADING_MESSAGE_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [active, hasBufferedVideo, videoReady]);

  useEffect(() => {
    if (!active || videoReady || !showLoadingMessage) return undefined;
    const id = window.setInterval(() => {
      setLoadingLineIndex((prev) => (prev + 1) % DRINK_LOADING_LINES.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, [active, showLoadingMessage, videoReady]);

  const markVideoBroken = useCallback(
    (current: CoffeePlayback | null) => {
      if (!current) {
        settlePlayback('failed');
        return;
      }

      setBlockedVideoSlugs((prev) => {
        if (prev.includes(current.id)) return prev;
        const next = [...prev, current.id];
        const fallback = getNextCoffeePlaybackFallback(current, next, ownedCoffeeVariants);
        if (fallback) {
          preloadCoffeePlayback(fallback);
        } else {
          settlePlayback('failed');
        }
        return next;
      });
    },
    [ownedCoffeeVariants, settlePlayback],
  );

  useEffect(() => {
    if (active && !wasActiveRef.current) {
      drinkVideoMutedRef.current = true;
      drinkVideoStartedRef.current = false;
      soundRequestedRef.current = false;
      settledRef.current = false;
      setBlockedVideoSlugs([]);
    }
    wasActiveRef.current = active;
  }, [active]);

  const playDrinkVideo = useCallback(
    async () => {
      const video = videoRef.current;
      if (!video) return;
      if (soundRequestedRef.current) {
        applyAudibleVideoAttributes(video);
      } else {
        applyMutedVideoAttributes(video);
      }

      if (!video.paused && video.currentTime > 0.05) return;

      video.loop = false;
      video.volume = DRINK_VIDEO_VOLUME;
      drinkVideoMutedRef.current = true;
      await video.play().catch(() => undefined);
    },
    [],
  );

  const unmuteDrinkVideo = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !drinkVideoMutedRef.current) return;

    soundRequestedRef.current = true;
    applyAudibleVideoAttributes(video);
    drinkVideoMutedRef.current = false;
    await unlock();
    if (video.paused) {
      await video.play().catch(() => undefined);
    }
  }, [unlock]);

  useImperativeHandle(ref, () => ({ unmute: unmuteDrinkVideo }), [unmuteDrinkVideo]);

  const markVideoReady = useCallback(() => {
    setVideoReady(true);
  }, []);

  const cycleLoadingLine = useCallback(() => {
    if (videoReady) return;
    setLoadingLineIndex((prev) => (prev + 1) % DRINK_LOADING_LINES.length);
  }, [videoReady]);

  useEffect(() => {
    if (!active || !drinkVideoSrc) return undefined;

    const video = videoRef.current;
    if (!video) return undefined;
    if (soundRequestedRef.current) {
      applyAudibleVideoAttributes(video);
    } else {
      applyMutedVideoAttributes(video);
    }

    drinkVideoStartedRef.current = false;
    let cancelled = false;

    const startOnce = () => {
      if (cancelled || drinkVideoStartedRef.current) return;
      drinkVideoStartedRef.current = true;
      void playDrinkVideo();
    };

    const onLoadedData = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        markVideoReady();
      }
      startOnce();
    };
    const onCanPlay = () => {
      markVideoReady();
      startOnce();
    };
    const onPlaying = () => {
      markVideoReady();
      onPlaybackStartedRef.current?.();
    };
    const onEnded = () => {
      if (cancelled) return;
      settlePlayback('ended');
    };
    const onError = () => {
      if (cancelled) return;
      markVideoBroken(playback);
    };
    const onNativeFullscreenEntered = () => {
      console.log('[drink-video-native-fullscreen-entered]', video.currentSrc || video.src);
    };
    const onNativeFullscreenEnded = () => {
      console.log('[drink-video-native-fullscreen-ended]', video.currentSrc || video.src);
    };

    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);
    video.addEventListener('webkitbeginfullscreen', onNativeFullscreenEntered);
    video.addEventListener('webkitendfullscreen', onNativeFullscreenEnded);

    video.load();
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      markVideoReady();
      startOnce();
    }

    return () => {
      cancelled = true;
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
      video.removeEventListener('webkitbeginfullscreen', onNativeFullscreenEntered);
      video.removeEventListener('webkitendfullscreen', onNativeFullscreenEnded);
      video.pause();
    };
  }, [active, playbackVideoSrc, playback, markVideoBroken, markVideoReady, playDrinkVideo, settlePlayback]);

  if (!active) {
    return null;
  }

  if (!playbackVideoSrc) {
    return (
      <div className="plant-scene__drink-media">
        <img className="plant-scene__bg plant-scene__bg--fallback" src={fallbackBgSrc} alt="창가 배경" />
      </div>
    );
  }

  return (
    <div className="plant-scene__drink-media plant-scene__drink-media--playback" aria-busy={!videoReady}>
      {showLoadingMessage ? (
        <button
          type="button"
          className={`plant-scene__drink-skeleton${videoReady ? ' plant-scene__drink-skeleton--hidden' : ''}`}
          aria-label="커피마시기 영상 준비 중"
          aria-live="polite"
          onClick={cycleLoadingLine}
        >
          <span className="plant-scene__drink-skeleton-shimmer" aria-hidden="true" />
          <span className="plant-scene__drink-skeleton-cup" aria-hidden="true">
            ☕
          </span>
          <span className="plant-scene__drink-skeleton-text">{loadingLine}</span>
          <span className="plant-scene__drink-skeleton-hint">탭하면 다음 안내를 볼 수 있어요</span>
        </button>
      ) : null}
      <video
        key={playbackVideoSrc}
        ref={videoRef}
        className={`plant-scene__bg plant-scene__bg--video${videoReady ? ' plant-scene__bg--video-ready' : ''}`}
        src={playbackVideoSrc}
        playsInline
        muted
        autoPlay
        preload="auto"
        webkit-playsinline=""
        aria-label="커피마시기"
        onPointerDown={() => {
          if (!videoReady) {
            cycleLoadingLine();
            return;
          }
          void unmuteDrinkVideo();
        }}
        onClick={() => {
          if (!videoReady) return;
          void unmuteDrinkVideo();
        }}
      />
    </div>
  );
}

export const PlantDrinkVideoLayer = memo(forwardRef(PlantDrinkVideoLayerComponent));
