import { memo } from 'react';
import type { HoldMode } from '../game/constants';
import { WatchAdButton } from './WatchAdButton';
import { WaterHoldCircle } from './WaterHoldCircle';

type PlantSceneActionLayerProps = {
  plantGrowth: number;
  growth: number;
  drinkStage: boolean;
  showAdSlot: boolean;
  growHoldDisabled: boolean;
  readyToDrink: boolean;
  isDrinkCommitting: boolean;
  disabled?: boolean;
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
};

function PlantSceneActionLayerComponent({
  plantGrowth,
  drinkStage,
  showAdSlot,
  growHoldDisabled,
  readyToDrink,
  isDrinkCommitting,
  disabled,
  watchingAd,
  watchAdDisabled,
  holdMode,
  isHolding,
  holdProgress,
  holdElapsedSec,
  holdTargetSec,
  holdRemainingSec,
  growth,
  onPointerDown,
  onPointerUp,
  onDrinkTap,
  onWatchAd,
}: PlantSceneActionLayerProps) {
  return (
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
  );
}

export const PlantSceneActionLayer = memo(PlantSceneActionLayerComponent);
