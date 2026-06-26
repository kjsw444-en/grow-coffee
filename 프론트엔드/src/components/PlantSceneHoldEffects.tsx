import { memo } from 'react';
import { WateringCanPour } from './WateringCanPour';

type PlantSceneHoldEffectsProps = {
  showWateringCan: boolean;
  holdProgress: number;
};

function PlantSceneHoldEffectsComponent({ showWateringCan, holdProgress }: PlantSceneHoldEffectsProps) {
  return <WateringCanPour active={showWateringCan} progress={holdProgress} />;
}

export const PlantSceneHoldEffects = memo(PlantSceneHoldEffectsComponent);
