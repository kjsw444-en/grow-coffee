import {
  COFFEE_COMPLETE_BG_SRC,
  COFFEE_STAGE_MIN,
  DRINK_STAGE_MIN,
  GROWTH_DISPLAY_DECIMALS,
  GROWTH_PER_WATER,
  PASSIVE_GROWTH_DISPLAY_DECIMALS,
  PLANT_BG_EARLY_SRC,
  PLANT_BG_MID_SRC,
  STAGES,
  TREE_GROWTH_DISPLAY_DECIMALS,
  TREE_GROWTH_IDLE_DECIMALS,
} from './constants';
import { PRE_DRINK_DISPLAY_MAX } from './growthHold';
import { roundGrowth } from './passiveGrowth';

const STAGES_DESC = [...STAGES].reverse();

export function getStage(growth: number) {
  return STAGES_DESC.find((stage) => growth >= stage.min) ?? STAGES[0];
}

/** 물주기 4단계 배경 — 0~50 / 50~75 / 75~99 */
export function getPlantBackgroundSrc(growth: number) {
  const value = roundGrowth(Math.min(100, Math.max(0, growth)));
  if (value >= COFFEE_STAGE_MIN) return COFFEE_COMPLETE_BG_SRC;
  if (value >= 50) return PLANT_BG_MID_SRC;
  return PLANT_BG_EARLY_SRC;
}

/** 식물 단계·배경 판정용 성장률 */
export function getPlantStageGrowth(growth: number) {
  return roundGrowth(Math.min(PRE_DRINK_DISPLAY_MAX, Math.max(0, growth)));
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

/** 게이지·숫자 라벨 공통 클램프 */
export function getTreeGaugeGrowth(growth: number) {
  return roundGrowth(Math.min(100, Math.max(0, growth)));
}

/** 게이지 바 너비·% 라벨 — 같은 값·같은 반올림 */
export function formatTreeGaugePercent(growth: number, live = false) {
  const value = getTreeGaugeGrowth(growth);
  if (value >= 100) return '100%';

  if (live) {
    return `${value.toFixed(TREE_GROWTH_DISPLAY_DECIMALS)}%`;
  }

  return `${value.toFixed(TREE_GROWTH_IDLE_DECIMALS)}%`;
}

/** 커피나무 성장률 — 대사·툴팁 등 */
export function formatTreeGrowthPercent(
  growth: number,
  decimals = TREE_GROWTH_IDLE_DECIMALS,
) {
  return formatTreeGaugePercent(growth, decimals > 0);
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
