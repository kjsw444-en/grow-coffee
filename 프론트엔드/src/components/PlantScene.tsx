import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CoffeeVariantSlug } from '../game/coffeeVariants';
import { getActiveCoffeePlayback, type SelectedCoffeeSlug } from '../game/hiddenCoffeeVariants';
import { isDrinkStage } from '../game/utils';
import type { HoldMode } from '../game/constants';
import type { GrowActionSlot } from '../game/waterQuota';
import type { DailyGameId } from '../services/dailyGamePick';
import { PlantDrinkVideoLayer, type PlantDrinkVideoHandle } from './PlantDrinkVideoLayer';
import { PlantSceneActionLayer } from './PlantSceneActionLayer';
import { PlantSceneArtLayer } from './PlantSceneArtLayer';
import { PlantSceneHoldEffects } from './PlantSceneHoldEffects';
import { DailyRitualGiftBox } from './DailyRitualGiftBox';
import './PlantScene.css';

type PlantSceneProps = {
  growth: number;
  /** 성장 게이지용 — 단계 이미지는 plantGrowth 기준 */
  plantGrowth: number;
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
  rouletteNudgeVisible?: boolean;
  rouletteNudgeText?: string;
  onRouletteNudgeClick?: () => void;
  fortuneNudgeVisible?: boolean;
  fortuneNudgeText?: string;
  onFortuneNudgeClick?: () => void;
  ritualGiftVisible?: boolean;
  ritualGiftDisabled?: boolean;
  onRitualGiftOpen?: () => void | Promise<void>;
  sceneDialogue?: string | null;
  harvestReward?: { cups: number | null; key: number } | null;
  money?: number;
  onCoffeeValuePress?: () => void;
  slotBelowShop?: ReactNode;
};

export const DRINK_VIDEO_ENABLED_STORAGE_KEY = 'grow-coffee-drink-video-enabled';
export const DRINK_VIDEO_SETTING_CHANGE_EVENT = 'grow-coffee-drink-video-setting-change';

function readDrinkVideoEnabled() {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(DRINK_VIDEO_ENABLED_STORAGE_KEY) !== 'off';
}

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
  rouletteNudgeVisible = false,
  rouletteNudgeText,
  onRouletteNudgeClick,
  fortuneNudgeVisible = false,
  fortuneNudgeText,
  onFortuneNudgeClick,
  ritualGiftVisible = false,
  ritualGiftDisabled,
  onRitualGiftOpen,
  sceneDialogue,
  harvestReward,
  money = 0,
  onCoffeeValuePress,
  slotBelowShop,
}: PlantSceneProps) {
  const drinkVideoRef = useRef<PlantDrinkVideoHandle>(null);
  const [drinkVideoEnabled, setDrinkVideoEnabled] = useState(readDrinkVideoEnabled);
  const [drinkVideoPopup, setDrinkVideoPopup] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const drinkStage = isDrinkStage(plantGrowth) || isDrinkCommitting;
  const showAdSlot = growActionSlot === 'ad';
  const growHoldDisabled = disabled || showAdSlot || !canUseGrowHold;
  const showDrinkVideo = drinkVideoEnabled && drinkUiActive && !isHolding && !suspendDrinkVideo;
  const drinkReadyImageSrc = useMemo(() => {
    if (!drinkStage || showDrinkVideo) return null;
    return getActiveCoffeePlayback(plantGrowth, selectedCoffeeVariant, ownedCoffeeVariants)?.drinkPreviewImage ?? null;
  }, [drinkStage, ownedCoffeeVariants, plantGrowth, selectedCoffeeVariant, showDrinkVideo]);
  const showWateringCan =
    isHolding && holdMode === 'water' && !showDrinkVideo && !drinkStage && !showAdSlot;

  const handleDrinkTap = () => {
    if (!drinkVideoEnabled) {
      onDrinkTap();
      return;
    }

    drinkVideoRef.current?.playFromUserGesture();
  };

  const handleDrinkVideoToggle = () => {
    const next = !drinkVideoEnabled;
    localStorage.setItem(DRINK_VIDEO_ENABLED_STORAGE_KEY, next ? 'on' : 'off');
    window.dispatchEvent(new Event(DRINK_VIDEO_SETTING_CHANGE_EVENT));
    setDrinkVideoEnabled(next);
    setDrinkVideoPopup(
      next
        ? {
            title: '동영상이 켜졌습니다',
            message:
              '커피 마시기를 누르면 동영상이 먼저 재생됩니다. 동영상이 끝난 뒤 보상 룰렛이 진행돼요.',
          }
        : {
            title: '동영상이 꺼졌습니다',
            message:
              '100% 화면에서는 기존 커피 캐릭터가 보입니다. 커피 마시기를 누르면 동영상 없이 바로 보상 룰렛으로 넘어가요.',
          },
    );
  };

  useEffect(() => {
    const syncDrinkVideoSetting = () => {
      setDrinkVideoEnabled(readDrinkVideoEnabled());
    };
    window.addEventListener(DRINK_VIDEO_SETTING_CHANGE_EVENT, syncDrinkVideoSetting);
    return () => {
      window.removeEventListener(DRINK_VIDEO_SETTING_CHANGE_EVENT, syncDrinkVideoSetting);
    };
  }, []);

  return (
    <section className="plant-scene">
      <div
        className={`plant-scene__frame ${isWatering ? 'plant-scene__frame--water' : ''} ${isReady ? 'plant-scene__frame--ready' : ''} ${showDrinkVideo ? 'plant-scene__frame--complete' : ''} ${tapBurst ? 'plant-scene__frame--bounce' : ''}`}
      >
        <div className={`plant-scene__art-wrap${showDrinkVideo ? ' plant-scene__art-wrap--drink' : ''}`}>
          {showDrinkVideo ? (
            <PlantDrinkVideoLayer
              ref={drinkVideoRef}
              active={showDrinkVideo}
              plantGrowth={plantGrowth}
              selectedCoffeeVariant={selectedCoffeeVariant}
              ownedCoffeeVariants={ownedCoffeeVariants}
              onPlaybackEnded={onDrinkTap}
            />
          ) : null}
          <PlantSceneArtLayer
            plantGrowth={plantGrowth}
            selectedCoffeeVariant={selectedCoffeeVariant}
            ownedCoffeeVariants={ownedCoffeeVariants}
            sceneDialogue={sceneDialogue}
            harvestReward={harvestReward}
            money={money}
            growth={growth}
            isHolding={isHolding}
            disabled={disabled}
            onCoffeeValuePress={onCoffeeValuePress}
            onCatPressStart={onCatPressStart}
            onCatPressEnd={onCatPressEnd}
            onOpenComicSeries={onOpenComicSeries}
            onOpenDailyGame={onOpenDailyGame}
            onOpenShop={onOpenShop}
            rouletteNudgeVisible={rouletteNudgeVisible}
            rouletteNudgeText={rouletteNudgeText}
            onRouletteNudgeClick={onRouletteNudgeClick}
            fortuneNudgeVisible={fortuneNudgeVisible}
            fortuneNudgeText={fortuneNudgeText}
            onFortuneNudgeClick={onFortuneNudgeClick}
            slotBelowShop={slotBelowShop}
            hideOverlay={showDrinkVideo}
            hidePlant={showDrinkVideo}
            hideCoffeeChip={drinkStage || showAdSlot}
            hideGrowthGauge={showAdSlot}
          />
          {drinkReadyImageSrc ? (
            <img
              className="plant-scene__drink-ready-image"
              src={drinkReadyImageSrc}
              alt=""
              draggable={false}
            />
          ) : null}
          {!showDrinkVideo ? (
            <button
              type="button"
              className={`plant-scene__video-toggle${drinkVideoEnabled ? '' : ' plant-scene__video-toggle--off'}`}
              aria-pressed={drinkVideoEnabled}
              aria-label={drinkVideoEnabled ? '커피마시기 동영상 켜짐' : '커피마시기 동영상 꺼짐'}
              title={drinkVideoEnabled ? '동영상 켜짐' : '동영상 꺼짐'}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                handleDrinkVideoToggle();
              }}
            >
              <small>{drinkVideoEnabled ? 'ON' : 'OFF'}</small>
              <span aria-hidden="true">🎬</span>
            </button>
          ) : null}
          {drinkVideoPopup ? (
            <div className="plant-scene__video-popup" role="dialog" aria-modal="true">
              <div className="plant-scene__video-popup-card">
                <strong>{drinkVideoPopup.title}</strong>
                <p>{drinkVideoPopup.message}</p>
                <button type="button" onClick={() => setDrinkVideoPopup(null)}>
                  확인
                </button>
              </div>
            </div>
          ) : null}
          <PlantSceneHoldEffects showWateringCan={showWateringCan} holdProgress={holdProgress} />
          <PlantSceneActionLayer
            plantGrowth={plantGrowth}
            growth={growth}
            drinkStage={drinkStage}
            showAdSlot={showAdSlot}
            growHoldDisabled={growHoldDisabled}
            readyToDrink={readyToDrink}
            isDrinkCommitting={isDrinkCommitting}
            disabled={disabled}
            watchingAd={watchingAd}
            watchAdDisabled={watchAdDisabled}
            holdMode={holdMode}
            isHolding={isHolding}
            holdProgress={holdProgress}
            holdElapsedSec={holdElapsedSec}
            holdTargetSec={holdTargetSec}
            holdRemainingSec={holdRemainingSec}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onDrinkTap={handleDrinkTap}
            onWatchAd={onWatchAd}
          />
          <DailyRitualGiftBox
            visible={ritualGiftVisible && !showDrinkVideo}
            disabled={ritualGiftDisabled}
            onOpen={() => onRitualGiftOpen?.()}
          />
        </div>
      </div>
    </section>
  );
}

export const PlantScene = memo(PlantSceneComponent);
