export const GOAL_AMOUNT = 4700;
export const SELL_PRICE = 47;
export const GROWTH_PER_WATER = 25;

/** 물 주기 꾹 누르기 시간 (초) — 매번 4~7초 랜덤 */
export const HOLD_MIN_SEC = 4;
export const HOLD_MAX_SEC = 7;

export const PLANT_BG_SRC = '/plant-bg.png';
/** 커피완성 단계(75%+) 배경 — 이미지 교체 시 public/plant-bg-complete.png */
export const PLANT_BG_COMPLETE_SRC = '/plant-bg-complete.png?v=1';
/** plant-bg.png 원본 비율 (473×1024) */
export const PLANT_BG_ASPECT = '473 / 1024';

/** 커피 단계(75%+) — 카페 배경 전환 */
export const COFFEE_STAGE_MIN = 75;
/** 커피마시기 단계(100%) */
export const DRINK_STAGE_MIN = 100;

export const PLANT_SEED_SRC = '/images/plant/plant-seed.png?v=3';
export const PLANT_SPROUT_SRC = '/images/plant/plant-sprout.png?v=1';
export const PLANT_BEAN_SRC = '/images/plant/plant-bean.png?v=2';
export const PLANT_COFFEE_SRC = '/images/plant/plant-complete.png?v=1';

/** 상단 추천 버튼 이미지 — PNG로 교체 가능 */
export const RECOMMEND_COFFEE_IMG = '/images/recommend/today-coffee.svg';
export const RECOMMEND_DINNER_IMG = '/images/recommend/today-dinner.svg';

export const STAGES = [
  { min: 0, label: '씨앗', emoji: '🫘', image: PLANT_SEED_SRC },
  { min: 25, label: '새싹', emoji: '🌱', image: PLANT_SPROUT_SRC },
  { min: 50, label: '원두', emoji: '☕', image: PLANT_BEAN_SRC },
  { min: 75, label: '커피', emoji: '✨', image: PLANT_COFFEE_SRC },
  { min: 100, label: '커피마시기', emoji: '☕', image: PLANT_COFFEE_SRC },
] as const;

export type HoldMode = 'water' | 'drink';

export const STORAGE_KEY = 'grow-coffee-save-v1';

export function randomWaterDurationSec() {
  const span = HOLD_MAX_SEC - HOLD_MIN_SEC + 1;
  return Math.floor(Math.random() * span) + HOLD_MIN_SEC;
}
