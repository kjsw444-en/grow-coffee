import { PLANT_BG_COMPLETE_SRC, PLANT_BG_SRC } from '../game/constants';
import { getStage, isCoffeeStage } from '../game/utils';
import { RecommendButtons } from './RecommendButtons';
import { WaterHoldCircle } from './WaterHoldCircle';
import type { HoldMode } from '../game/constants';
import './PlantScene.css';

type PlantSceneProps = {
  growth: number;
  isWatering: boolean;
  isReady: boolean;
  tapBurst: boolean;
  disabled?: boolean;
  readyToDrink: boolean;
  holdMode: HoldMode;
  isHolding: boolean;
  holdProgress: number;
  holdElapsedSec: number;
  holdTargetSec: number;
  holdRemainingSec: number;
  onPointerDown: () => void;
  onPointerUp: () => void;
};

export function PlantScene({
  growth,
  isWatering,
  isReady,
  tapBurst,
  disabled,
  readyToDrink,
  holdMode,
  isHolding,
  holdProgress,
  holdElapsedSec,
  holdTargetSec,
  holdRemainingSec,
  onPointerDown,
  onPointerUp,
}: PlantSceneProps) {
  const stage = getStage(growth);
  const coffeeStage = isCoffeeStage(growth);
  const bgSrc = coffeeStage ? PLANT_BG_COMPLETE_SRC : PLANT_BG_SRC;
  const isPotStage = stage.min < 75;
  const slotClass = isPotStage ? 'plant-scene__plant-slot--pot' : 'plant-scene__plant-slot--complete';
  const imgClass = isPotStage ? 'plant-scene__plant-img--pot' : 'plant-scene__plant-img--complete';
  const activeHoldMode: HoldMode = readyToDrink ? 'drink' : holdMode;

  return (
    <section className="plant-scene">
      <div
        className={`plant-scene__frame ${isWatering ? 'plant-scene__frame--water' : ''} ${isReady ? 'plant-scene__frame--ready' : ''} ${coffeeStage ? 'plant-scene__frame--complete' : ''} ${tapBurst ? 'plant-scene__frame--bounce' : ''}`}
      >
        <div className="plant-scene__art-wrap">
          <img className="plant-scene__bg" src={bgSrc} alt={coffeeStage ? '커피 카페 배경' : '창가 배경'} />
          <RecommendButtons />
          {!coffeeStage && (
            <div
              className={`plant-scene__plant-slot ${slotClass}`}
              aria-label={`성장 단계: ${stage.label}`}
            >
              <img
                className={`plant-scene__plant-visual plant-scene__plant-img ${imgClass}`}
                src={stage.image}
                alt={`${stage.label} 커피`}
              />
            </div>
          )}
          <div className={`plant-scene__action-slot ${readyToDrink ? 'plant-scene__action-slot--drink' : ''}`}>
            <WaterHoldCircle
              embedded
              disabled={disabled}
              holdMode={activeHoldMode}
              isHolding={isHolding}
              holdProgress={holdProgress}
              holdElapsedSec={holdElapsedSec}
              holdTargetSec={holdTargetSec}
              holdRemainingSec={holdRemainingSec}
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
