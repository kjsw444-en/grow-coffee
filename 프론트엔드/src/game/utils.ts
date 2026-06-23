import {
  COFFEE_STAGE_MIN,
  DRINK_STAGE_MIN,
  GROWTH_DISPLAY_DECIMALS,
  GROWTH_PER_WATER,
  PASSIVE_GROWTH_DISPLAY_DECIMALS,
  STAGES,
  TREE_GROWTH_DISPLAY_DECIMALS,
} from './constants';
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

/** 광고 후 재사용 버튼 — 커피 단계(75%+)에서는 「커피 한잔」 */
export function getRefillActionLabel(growth: number) {
  return isCoffeeStage(growth) ? '커피 한잔' : '물 채우기';
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

/** 커피나무 성장률 — 소수 2자리, 물주기 중에는 displayGrowth와 함께 서서히 상승 */
export function formatTreeGrowthPercent(
  growth: number,
  decimals = TREE_GROWTH_DISPLAY_DECIMALS,
) {
  const value = roundGrowth(Math.min(100, Math.max(0, growth)));
  if (value >= 100) {
    return decimals > 0 ? `100.${'0'.repeat(decimals)}%` : '100%';
  }

  return `${value.toFixed(decimals)}%`;
}

/** 확정 성장치를 25% 단위로 맞춤 — UI·표시용 */
export function snapTreeGrowthPercent(growth: number) {
  const value = Math.min(100, Math.max(0, growth));
  if (value >= 100) return 100;
  return Math.round(value / GROWTH_PER_WATER) * GROWTH_PER_WATER;
}

/** 방치 커피 충전 게이지 — 소수점으로 서서히 오르는 것 표시 */
export function formatPassiveGrowthPercent(
  growth: number,
  decimals = PASSIVE_GROWTH_DISPLAY_DECIMALS,
) {
  const value = roundGrowth(Math.min(100, Math.max(0, growth)));
  if (value >= 100) {
    return decimals > 0 ? `100.${'0'.repeat(decimals)}%` : '100%';
  }

  return `${value.toFixed(decimals)}%`;
}
