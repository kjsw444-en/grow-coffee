import { memo, useMemo, type CSSProperties, type ReactNode } from 'react';
import { useButtonSound } from '../audio/SoundProvider';
import {
  COFFEE_COMPLETE_BG_SRC,
  PLANT_BG_SRC,
} from '../game/constants';
import type { CoffeeVariantSlug } from '../game/coffeeVariants';
import {
  getActiveCoffeePlayback,
  type SelectedCoffeeSlug,
} from '../game/hiddenCoffeeVariants';
import { formatWon, getStage, isCoffeeStage, isDrinkStage } from '../game/utils';
import { CatBonusButton } from './CatBonusButton';
import { RecommendButtons } from './RecommendButtons';
import { SceneDialogueBox } from './SceneDialogueBox';
import type { DailyGameId } from '../services/dailyGamePick';

type PlantSceneArtLayerProps = {
  plantGrowth: number;
  selectedCoffeeVariant: SelectedCoffeeSlug;
  ownedCoffeeVariants: CoffeeVariantSlug[];
  sceneDialogue?: string | null;
  harvestReward?: { cups: number | null; key: number } | null;
  money?: number;
  disabled?: boolean;
  onCoffeeValuePress?: () => void;
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
  hideOverlay?: boolean;
  hidePlant?: boolean;
  hideCoffeeChip?: boolean;
  slotBelowShop?: ReactNode;
};

function PlantSceneArtLayerComponent({
  plantGrowth,
  selectedCoffeeVariant,
  ownedCoffeeVariants,
  sceneDialogue,
  harvestReward,
  money = 0,
  disabled,
  onCoffeeValuePress,
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
  hideOverlay = false,
  hidePlant = false,
  hideCoffeeChip = false,
  slotBelowShop,
}: PlantSceneArtLayerProps) {
  const buttonSound = useButtonSound();
  const stage = getStage(plantGrowth);
  const drinkStage = isDrinkStage(plantGrowth);
  const coffeeStage = isCoffeeStage(plantGrowth) && !drinkStage;
  const showCoffeeVariant = isCoffeeStage(plantGrowth) || drinkStage;
  const storedPlayback = useMemo((): ReturnType<typeof getActiveCoffeePlayback> | null => {
    if (!showCoffeeVariant) return null;
    return getActiveCoffeePlayback(plantGrowth, selectedCoffeeVariant, ownedCoffeeVariants);
  }, [showCoffeeVariant, plantGrowth, selectedCoffeeVariant, ownedCoffeeVariants]);

  const plantImageSrc = coffeeStage && storedPlayback ? storedPlayback.image : stage.image;
  const plantImageKey = coffeeStage && storedPlayback ? storedPlayback.id : stage.min;
  const bgSrc = coffeeStage ? COFFEE_COMPLETE_BG_SRC : PLANT_BG_SRC;
  const harvestRewardStopY =
    harvestReward?.cups == null
      ? 0
      : -28 * Math.max(0, Math.min(4, Math.floor(harvestReward.cups) - 1));

  return (
    <>
      {!hideOverlay && (
        <img className="plant-scene__bg" src={bgSrc} alt="창가 배경" />
      )}
      {harvestReward && (
        <div
          key={harvestReward.key}
          className={`game__harvest-reward-pop${harvestReward.cups == null ? ' game__harvest-reward-pop--rolling' : ''}`}
          role="status"
          aria-live="polite"
        >
          <span className="game__harvest-reward-roll" aria-hidden="true">
            {[0, 1, 2].map((reel) => (
              <span
                key={reel}
                className="game__harvest-reward-reel"
                style={
                  harvestReward.cups == null
                    ? undefined
                    : ({ '--slot-stop-y': `${harvestRewardStopY}px` } as CSSProperties)
                }
              >
                {[1, 2, 3, 4, 5, 1, 2, 3, 4, 5].map((cup, index) => (
                  <span key={`${cup}-${index}`}>{cup}</span>
                ))}
              </span>
            ))}
          </span>
          <strong className="game__harvest-reward-cups">
            {harvestReward.cups == null ? '...' : `+${harvestReward.cups}잔`}
          </strong>
          {harvestReward.cups != null && (
            <span className="game__harvest-reward-caption">내린 커피 획득!</span>
          )}
        </div>
      )}
      {!hideOverlay && (
        <div className="plant-scene__top-stack">
          <RecommendButtons
            onOpenComicSeries={onOpenComicSeries}
            onOpenDailyGame={onOpenDailyGame}
            onOpenShop={onOpenShop}
            slotBelowShop={slotBelowShop}
          />
          <SceneDialogueBox message={sceneDialogue} />
        </div>
      )}
      {!hideOverlay && (
        <CatBonusButton
          disabled={disabled}
          fortuneNudgeVisible={fortuneNudgeVisible}
          fortuneNudgeText={fortuneNudgeText}
          onFortuneNudgeClick={onFortuneNudgeClick}
          rouletteNudgeVisible={rouletteNudgeVisible}
          rouletteNudgeText={rouletteNudgeText}
          onRouletteNudgeClick={onRouletteNudgeClick}
          onPressStart={onCatPressStart}
          onPressEnd={onCatPressEnd}
        />
      )}
      {!hidePlant && (
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
      {!hideCoffeeChip && (
        <button
          type="button"
          className="plant-scene__coffee-value-chip"
          aria-label={`커피값 ${formatWon(money)} · 지금까지 지급받은 실제 커피값 수치`}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            void buttonSound();
            onCoffeeValuePress?.();
          }}
        >
          <span className="plant-scene__coffee-value-chip-label">커피값</span>
          <strong>{formatWon(money)}</strong>
        </button>
      )}
    </>
  );
}

export const PlantSceneArtLayer = memo(PlantSceneArtLayerComponent);
