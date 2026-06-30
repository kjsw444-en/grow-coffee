import { isDrinkStage } from './utils';
import { isReadyToDrinkGrowth } from './growthHold';

export type DrinkClickLogSnapshot = {
  growthPercent: number;
  isCoffeeComplete: boolean;
  canDrinkCoffee: boolean;
  coffeeStage: boolean;
  serverGrowthPercent: number;
};

export function buildDrinkClickLogSnapshot(
  displayGrowth: number,
  serverGrowth: number,
  canDrinkCoffee: boolean,
): DrinkClickLogSnapshot {
  const growthPercent = displayGrowth;
  const serverGrowthPercent = serverGrowth;

  return {
    growthPercent,
    isCoffeeComplete: isReadyToDrinkGrowth(serverGrowthPercent),
    canDrinkCoffee,
    coffeeStage: isDrinkStage(serverGrowthPercent),
    serverGrowthPercent,
  };
}

export function logDrinkClickPhase(
  phase: 'before' | 'after',
  snapshot: DrinkClickLogSnapshot,
) {
  console.log(`[drink-click-${phase}]`, snapshot);
}
