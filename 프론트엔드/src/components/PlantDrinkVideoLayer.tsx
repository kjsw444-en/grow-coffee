import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ForwardedRef } from 'react';
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
  unmute: () => Promise<void>;
};

type PlantDrinkVideoLayerProps = {
  active: boolean;
  plantGrowth: number;
  selectedCoffeeVariant: SelectedCoffeeSlug;
  ownedCoffeeVariants: CoffeeVariantSlug[];
  fallbackBgSrc?: string;
};

function PlantDrinkVideoLayerComponent(
  {
    active,
    plantGrowth,
    selectedCoffeeVariant,
    ownedCoffeeVariants,
    fallbackBgSrc = COFFEE_COMPLETE_BG_SRC,
  }: PlantDrinkVideoLayerProps,
  ref: ForwardedRef<PlantDrinkVideoHandle>,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wasActiveRef = useRef(false);
  const drinkVideoMutedRef = useRef(true);
  const drinkVideoStartedRef = useRef(false);
  const { unlock, unlocked } = useSound();
  const unlockedRef = useRef(unlocked);
  unlockedRef.current = unlocked;
  const [blockedVideoSlugs, setBlockedVideoSlugs] = useState<SelectedCoffeeSlug[]>([]);

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

  useEffect(() => {
    if (!storedPlayback) return;
    preloadCoffeePlayback(storedPlayback);
  }, [storedPlayback]);

  useEffect(() => {
    if (!playback || playback.id === storedPlayback?.id) return;
    preloadCoffeePlayback(playback);
  }, [playback, storedPlayback?.id]);

  const markVideoBroken = useCallback(
    (current: CoffeePlayback | null) => {
      if (!current) return;
      setBlockedVideoSlugs((prev) => {
        if (prev.includes(current.id)) return prev;
        const next = [...prev, current.id];
        const fallback = getNextCoffeePlaybackFallback(current, next, ownedCoffeeVariants);
        if (fallback) {
          preloadCoffeePlayback(fallback);
        }
        return next;
      });
    },
    [ownedCoffeeVariants],
  );

  useEffect(() => {
    if (active && !wasActiveRef.current) {
      drinkVideoMutedRef.current = true;
      drinkVideoStartedRef.current = false;
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
          // autoplay policy — fall back to muted playback
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

  useImperativeHandle(ref, () => ({ unmute: unmuteDrinkVideo }), [unmuteDrinkVideo]);

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

    const onLoadedData = () => startOnce();
    const onCanPlay = () => startOnce();
    const onCanPlayThrough = () => startOnce();
    const onError = () => {
      if (cancelled) return;
      markVideoBroken(playback);
    };

    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('canplaythrough', onCanPlayThrough);
    video.addEventListener('error', onError);

    video.load();
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      startOnce();
    }

    return () => {
      cancelled = true;
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('canplaythrough', onCanPlayThrough);
      video.removeEventListener('error', onError);
      video.pause();
    };
  }, [active, drinkVideoSrc, playback, markVideoBroken, playDrinkVideo]);

  if (!active) {
    return null;
  }

  if (!drinkVideoSrc) {
    return <img className="plant-scene__bg" src={fallbackBgSrc} alt="창가 배경" />;
  }

  return (
    <video
      key={drinkVideoSrc}
      ref={videoRef}
      className="plant-scene__bg plant-scene__bg--video"
      src={drinkVideoSrc}
      playsInline
      muted
      autoPlay
      preload="auto"
      aria-label="커피마시기"
      onPointerDown={() => {
        void unmuteDrinkVideo();
      }}
      onClick={() => {
        void unmuteDrinkVideo();
      }}
    />
  );
}

export const PlantDrinkVideoLayer = memo(forwardRef(PlantDrinkVideoLayerComponent));
