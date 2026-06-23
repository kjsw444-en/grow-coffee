import { COFFEE_STAGE_MIN, DRINK_STAGE_MIN, GROWTH_DISPLAY_DECIMALS, STAGES } from './constants';
import { roundGrowth } from './passiveGrowth';

const STAGES_DESC = [...STAGES].reverse();

export function getStage(growth: number) {
  return STAGES_DESC.find((stage) => growth >= stage.min) ?? STAGES[0];
}

export function getStageGrowthRange(stage: (typeof STAGES)[number]) {
  const index = STAGES.findIndex((item) => item.min === stage.min);
  const next = STAGES[index + 1];

  if (!next) {
    return `${stage.min}%`;
  }

  const max = next.min - 1;
  return `${stage.min}~${max}%`;
}

export function isCoffeeStage(growth: number) {
  return growth >= COFFEE_STAGE_MIN;
}

export function isDrinkStage(growth: number) {
  return roundGrowth(growth) >= DRINK_STAGE_MIN;
}

export function formatWon(amount: number) {
  return `${amount.toLocaleString('ko-KR')}원`;
}

export function formatGrowthPercent(growth: number) {
  const value = roundGrowth(Math.min(100, Math.max(0, growth)));
  if (value >= 100) {
    return '100%';
  }

  return `${value.toFixed(GROWTH_DISPLAY_DECIMALS)}%`;
}
