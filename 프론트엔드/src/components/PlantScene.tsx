import { memo, useRef, type ReactNode } from 'react';
import type { CoffeeVariantSlug } from '../game/coffeeVariants';
import type { SelectedCoffeeSlug } from '../game/hiddenCoffeeVariants';
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
  const drinkStage = isDrinkStage(plantGrowth) || isDrinkCommitting;
  const showAdSlot = growActionSlot === 'ad';
  const growHoldDisabled = disabled || showAdSlot || !canUseGrowHold;
  const showDrinkVideo = drinkUiActive && !isHolding && !suspendDrinkVideo;
  const showWateringCan =
    isHolding && holdMode === 'water' && !showDrinkVideo && !drinkStage && !showAdSlot;

  const handleUnmuteDrinkVideo = () => {
    void drinkVideoRef.current?.unmute();
  };

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
            />
          ) : null}
          <PlantSceneArtLayer
            plantGrowth={plantGrowth}
            selectedCoffeeVariant={selectedCoffeeVariant}
            ownedCoffeeVariants={ownedCoffeeVariants}
            sceneDialogue={sceneDialogue}
            harvestReward={harvestReward}
            money={money}
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
          />
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
            onDrinkTap={onDrinkTap}
            onWatchAd={onWatchAd}
            onUnmuteDrinkVideo={handleUnmuteDrinkVideo}
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
