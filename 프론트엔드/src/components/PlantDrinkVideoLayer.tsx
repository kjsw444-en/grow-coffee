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

const DRINK_LOADING_LINES = [
  '곧 바리스타가 나와요…',
  '따뜻한 라떼 준비 중이에요 ☕',
  '조금만 기다려 주세요',
] as const;

function PlantDrinkVideoLayerComponent(
  {
    active,
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const wasActiveRef = useRef(false);
  const drinkVideoMutedRef = useRef(true);
  const drinkVideoStartedRef = useRef(false);
  const settledRef = useRef(false);
  const { unlock, unlocked } = useSound();
  const unlockedRef = useRef(unlocked);
  unlockedRef.current = unlocked;

  const onPlaybackStartedRef = useRef(onPlaybackStarted);
  const onPlaybackEndedRef = useRef(onPlaybackEnded);
  const onPlaybackFailedRef = useRef(onPlaybackFailed);
  onPlaybackStartedRef.current = onPlaybackStarted;
  onPlaybackEndedRef.current = onPlaybackEnded;
  onPlaybackFailedRef.current = onPlaybackFailed;

  const [blockedVideoSlugs, setBlockedVideoSlugs] = useState<SelectedCoffeeSlug[]>([]);
  const [videoReady, setVideoReady] = useState(false);
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
    setLoadingLineIndex(0);
    settledRef.current = false;
  }, [drinkVideoSrc, active]);

  useEffect(() => {
    if (!active || videoReady) return undefined;
    const id = window.setInterval(() => {
      setLoadingLineIndex((prev) => (prev + 1) % DRINK_LOADING_LINES.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, [active, videoReady]);

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
      settledRef.current = false;
      setBlockedVideoSlugs([]);
    }
    wasActiveRef.current = active;
  }, [active]);

  const playDrinkVideo = useCallback(
    async (preferSound: boolean) => {
      const video = videoRef.current;
      if (!video) return;

      if (!video.paused && video.currentTime > 0.05) {
        if (preferSound && drinkVideoMutedRef.current) {
          await unlock();
          video.muted = false;
          drinkVideoMutedRef.current = false;
          video.volume = DRINK_VIDEO_VOLUME;
        }
        return;
      }

      video.loop = false;
      video.volume = DRINK_VIDEO_VOLUME;

      if (preferSound) {
        await unlock();
        video.muted = false;
        drinkVideoMutedRef.current = false;
        try {
          await video.play();
          return;
        } catch {
          // Autoplay policy fallback: keep the stable bundle's muted path.
        }
      }

      video.muted = true;
      drinkVideoMutedRef.current = true;
      await video.play().catch(() => undefined);
    },
    [unlock],
  );

  const unmuteDrinkVideo = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !drinkVideoMutedRef.current) return;

    await unlock();
    video.muted = false;
    drinkVideoMutedRef.current = false;
    video.volume = DRINK_VIDEO_VOLUME;
    if (video.paused) {
      await video.play().catch(() => undefined);
    }
  }, [unlock]);

  const playFromUserGesture = useCallback((): boolean => {
    void unmuteDrinkVideo();
    return true;
  }, [unmuteDrinkVideo]);

  useImperativeHandle(ref, () => ({ playFromUserGesture }), [playFromUserGesture]);

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

    drinkVideoStartedRef.current = false;
    let cancelled = false;

    const startOnce = () => {
      if (cancelled || drinkVideoStartedRef.current) return;
      drinkVideoStartedRef.current = true;
      void playDrinkVideo(unlockedRef.current);
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

    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);

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
      video.pause();
    };
  }, [active, drinkVideoSrc, playback, markVideoBroken, markVideoReady, playDrinkVideo, settlePlayback]);

  if (!active) {
    return null;
  }

  if (!drinkVideoSrc) {
    return (
      <div ref={hostRef} className="plant-scene__drink-media">
        <img className="plant-scene__bg plant-scene__bg--fallback" src={COFFEE_COMPLETE_BG_SRC} alt="창가 배경" />
      </div>
    );
  }

  return (
    <div ref={hostRef} className="plant-scene__drink-media" aria-busy={!videoReady}>
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
      <video
        key={drinkVideoSrc}
        ref={videoRef}
        className={`plant-scene__bg plant-scene__bg--video${videoReady ? ' plant-scene__bg--video-ready' : ''}`}
        src={drinkVideoSrc}
        playsInline
        muted
        autoPlay
        preload="auto"
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
