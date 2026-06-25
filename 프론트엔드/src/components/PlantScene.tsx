import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSound } from '../audio/SoundProvider';
import {
  COFFEE_COMPLETE_BG_SRC,
  COFFEE_STAGE_MIN,
  DRINK_VIDEO_VOLUME,
  PLANT_BG_SRC,
} from '../game/constants';
import {
  type CoffeeVariantSlug,
} from '../game/coffeeVariants';
import {
  getActiveCoffeePlayback,
  getNextCoffeePlaybackFallback,
  preloadCoffeePlayback,
  type CoffeePlayback,
  type SelectedCoffeeSlug,
} from '../game/hiddenCoffeeVariants';
import { getStage, isCoffeeStage, isDrinkStage } from '../game/utils';
import { CatBonusButton } from './CatBonusButton';
import { SceneDialogueBox } from './SceneDialogueBox';
import { RecommendButtons } from './RecommendButtons';
import { WatchAdButton } from './WatchAdButton';
import { WaterHoldCircle } from './WaterHoldCircle';
import { WateringCanPour } from './WateringCanPour';
import type { HoldMode } from '../game/constants';
import type { GrowActionSlot } from '../game/waterQuota';
import type { DailyGameId } from '../services/dailyGamePick';
import './PlantScene.css';

type PlantSceneProps = {
  growth: number;
  /** 성장 게이지용 — 단계 이미지는 plantGrowth 기준 */
  plantGrowth: number;
  /** 75% 커피·100% 영상 — 선택된 캐릭터 또는 히든 */
  selectedCoffeeVariant: SelectedCoffeeSlug;
  ownedCoffeeVariants: CoffeeVariantSlug[];
  isWatering: boolean;
  isReady: boolean;
  tapBurst: boolean;
  disabled?: boolean;
  readyToDrink: boolean;
  drinkUiActive: boolean;
  isDrinkCommitting?: boolean;
  suspendDrinkVideo?: boolean;
  needsAd: boolean;
  showWatchAdButton: boolean;
  growActionSlot: GrowActionSlot;
  canUseGrowHold: boolean;
  canWater: boolean;
  watchingAd: boolean;
  watchAdDisabled?: boolean;
  holdMode: HoldMode;
  isHolding: boolean;
  holdProgress: number;
  holdElapsedSec: number;
  holdTargetSec: number;
  holdRemainingSec: number;
  onPointerDown: () => void;
  onPointerUp: () => void;
  onDrinkTap: () => void;
  onWatchAd: () => void;
  onCatPressStart: () => void;
  onCatPressEnd: () => void;
  onOpenComicSeries?: (seriesId: string) => void;
  onOpenDailyGame?: (gameId: DailyGameId) => void;
  onOpenShop?: () => void;
  sceneDialogue?: string | null;
};

function PlantSceneComponent({
  growth,
  plantGrowth,
  selectedCoffeeVariant,
  ownedCoffeeVariants,
  isWatering,
  isReady,
  tapBurst,
  disabled,
  readyToDrink,
  drinkUiActive,
  isDrinkCommitting = false,
  suspendDrinkVideo = false,
  growActionSlot,
  canUseGrowHold,
  watchingAd,
  watchAdDisabled,
  holdMode,
  isHolding,
  holdProgress,
  holdElapsedSec,
  holdTargetSec,
  holdRemainingSec,
  onPointerDown,
  onPointerUp,
  onDrinkTap,
  onWatchAd,
  onCatPressStart,
  onCatPressEnd,
  onOpenComicSeries,
  onOpenDailyGame,
  onOpenShop,
  sceneDialogue,
}: PlantSceneProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wasDrinkStageRef = useRef(false);
  const drinkVideoMutedRef = useRef(true);
  const drinkVideoStartedRef = useRef(false);
  const { unlock, unlocked } = useSound();
  const unlockedRef = useRef(unlocked);
  unlockedRef.current = unlocked;
  const stage = getStage(plantGrowth);
  const drinkStage = isDrinkStage(plantGrowth) || isDrinkCommitting;
  const showAdSlot = growActionSlot === 'ad';
  const growHoldDisabled = disabled || showAdSlot || !canUseGrowHold;
  /** 영상은 state 100% + 마시기 준비 + 홀드 종료 후에만 — API 처리 중에도 유지 */
  const showDrinkVideo = drinkUiActive && !isHolding && !suspendDrinkVideo;
  const coffeeStage = isCoffeeStage(plantGrowth) && !drinkStage;
  const showCoffeeVariant = isCoffeeStage(plantGrowth) || drinkStage;
  const storedPlayback = useMemo((): CoffeePlayback | null => {
    if (!showCoffeeVariant) return null;
    return getActiveCoffeePlayback(plantGrowth, selectedCoffeeVariant, ownedCoffeeVariants);
  }, [showCoffeeVariant, plantGrowth, selectedCoffeeVariant, ownedCoffeeVariants]);
  const [blockedVideoSlugs, setBlockedVideoSlugs] = useState<SelectedCoffeeSlug[]>([]);
  const playback: CoffeePlayback | null = storedPlayback
    ? blockedVideoSlugs.includes(storedPlayback.id)
      ? getNextCoffeePlaybackFallback(storedPlayback, blockedVideoSlugs, ownedCoffeeVariants) ??
        storedPlayback
      : storedPlayback
    : null;
  const plantImageSrc = coffeeStage && storedPlayback ? storedPlayback.image : stage.image;
  const plantImageKey = coffeeStage && storedPlayback ? storedPlayback.id : stage.min;
  const bgSrc = coffeeStage ? COFFEE_COMPLETE_BG_SRC : PLANT_BG_SRC;

  useEffect(() => {
    if (plantGrowth >= COFFEE_STAGE_MIN) return;
    setBlockedVideoSlugs([]);
  }, [plantGrowth]);

  useEffect(() => {
    if (!storedPlayback) return;
    preloadCoffeePlayback(storedPlayback);
  }, [storedPlayback]);

  useEffect(() => {
    if (!playback || playback.id === storedPlayback?.id) return;
    preloadCoffeePlayback(playback);
  }, [playback, storedPlayback?.id]);

  const drinkVideoSrc = playback?.video ?? null;
  const showWateringCan =
    isHolding && holdMode === 'water' && !showDrinkVideo && !drinkStage && !showAdSlot;

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
    if (showDrinkVideo && !wasDrinkStageRef.current) {
      drinkVideoMutedRef.current = true;
      drinkVideoStartedRef.current = false;
      setBlockedVideoSlugs([]);
    }

    wasDrinkStageRef.current = showDrinkVideo;
  }, [showDrinkVideo]);

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

  useEffect(() => {
    if (!showDrinkVideo || !drinkVideoSrc) return undefined;

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
  }, [showDrinkVideo, drinkVideoSrc, playback, markVideoBroken, playDrinkVideo]);

  return (
    <section className="plant-scene">
      <div
        className={`plant-scene__frame ${isWatering ? 'plant-scene__frame--water' : ''} ${isReady ? 'plant-scene__frame--ready' : ''} ${showDrinkVideo ? 'plant-scene__frame--complete' : ''} ${tapBurst ? 'plant-scene__frame--bounce' : ''}`}
      >
        <div
          className={`plant-scene__art-wrap${showDrinkVideo ? ' plant-scene__art-wrap--drink' : ''}`}
          onPointerDown={() => {
            if (showDrinkVideo) void unmuteDrinkVideo();
          }}
          onClick={() => {
            if (showDrinkVideo) void unmuteDrinkVideo();
          }}
        >
          {showDrinkVideo ? (
            drinkVideoSrc ? (
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
              />
            ) : (
              <img className="plant-scene__bg" src={bgSrc} alt="창가 배경" />
            )
          ) : (
            <img className="plant-scene__bg" src={bgSrc} alt="창가 배경" />
          )}
          {!showDrinkVideo && (
            <div className="plant-scene__top-stack">
              <RecommendButtons
                onOpenComicSeries={onOpenComicSeries}
                onOpenDailyGame={onOpenDailyGame}
                onOpenShop={onOpenShop}
              />
              <SceneDialogueBox message={sceneDialogue} />
            </div>
          )}
          {!showDrinkVideo && (
            <CatBonusButton
              disabled={disabled}
              onPressStart={onCatPressStart}
              onPressEnd={onCatPressEnd}
            />
          )}
          {!showDrinkVideo && (
            <div
              className={`plant-scene__plant-slot${coffeeStage ? ' plant-scene__plant-slot--coffee' : ''}`}
              aria-label={`성장 단계: ${storedPlayback?.label ?? stage.label}`}
            >
              <img
                key={plantImageKey}
                className="plant-scene__plant-visual plant-scene__plant-img"
                src={plantImageSrc}
                alt={`${storedPlayback?.label ?? stage.label} 커피`}
              />
            </div>
          )}
          <WateringCanPour active={showWateringCan} progress={holdProgress} />
          <div
            className={`plant-scene__action-slot ${drinkStage ? 'plant-scene__action-slot--drink-finish' : ''} ${showAdSlot ? 'plant-scene__action-slot--ad' : ''}`}
          >
            {drinkStage ? (
              <button
                type="button"
                className={`plant-scene__drink-btn${isDrinkCommitting ? ' plant-scene__drink-btn--loading' : ''}`}
                disabled={disabled || (!readyToDrink && !isDrinkCommitting)}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  if (disabled || !readyToDrink) return;
                  void unmuteDrinkVideo();
                  onDrinkTap();
                }}
              >
                {isDrinkCommitting ? '마시는 중…' : '커피 마시기'}
              </button>
            ) : showAdSlot ? (
              <WatchAdButton
                growth={plantGrowth}
                disabled={watchAdDisabled ?? disabled}
                loading={watchingAd}
                embedded
                onWatchAd={onWatchAd}
              />
            ) : (
              <WaterHoldCircle
                embedded
                growth={growth}
                disabled={growHoldDisabled}
                holdMode={holdMode}
                isHolding={isHolding}
                holdProgress={holdProgress}
                holdElapsedSec={holdElapsedSec}
                holdTargetSec={holdTargetSec}
                holdRemainingSec={holdRemainingSec}
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export const PlantScene = memo(PlantSceneComponent);
