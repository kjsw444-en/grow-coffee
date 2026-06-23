export const GOAL_AMOUNT = 4700;
export const SELL_PRICE = 47;
export const SELL_BATCH_SIZE = 10;
export const SELL_BATCH_REWARD = 47;
export const GROWTH_PER_WATER = 25;

/** 햇빛 방치 — 20분 = 100%, 하루 최대 2잔(200%) */
export const PASSIVE_MINUTES_PER_CUP = 20;
export const PASSIVE_GROWTH_PER_SECOND = 100 / (PASSIVE_MINUTES_PER_CUP * 60);
export const DAILY_PASSIVE_GROWTH_CAP = 200;
/** 방치 성장 UI 갱신 주기(ms) — 소수점 변화가 보이도록 */
export const PASSIVE_DISPLAY_TICK_MS = 100;
/** 성장률 표시 소수 자릿수 */
export const GROWTH_DISPLAY_DECIMALS = 5;

/** 물 주기 꾹 누르기 시간 (초) — 매번 4~7초 랜덤 */
export const HOLD_MIN_SEC = 4;
export const HOLD_MAX_SEC = 7;

export const PLANT_BG_SRC = '/plant-bg.png';
/** 커피 완성 단계(75~99%) 배경 — 473×1024 */
export const COFFEE_COMPLETE_BG_SRC = '/images/plant/coffee-complete-bg.png?v=2';
export const WATERING_CAN_SRC = '/images/plant/watering-can.png?v=11';
/** 커피냥 버튼 캐릭터 */
export const CAT_BUTTON_SRC = '/images/cat-button.png?v=5';
export const CAT_BUTTON_PRESSED_SRC = '/images/cat-button-pressed.png?v=1';
/** 커피마시기 단계(100%) — 커피 종류별 영상 (이미지와 슬러그로 매칭) */
export { COFFEE_VARIANTS, type CoffeeVariant, type CoffeeVariantSlug } from './coffeeVariants';
import { COFFEE_VARIANTS } from './coffeeVariants';

export const DRINK_VIDEO_SOURCES = COFFEE_VARIANTS.map((variant) => variant.video);
/** 커피마시기 영상 볼륨 (0~1) */
export const DRINK_VIDEO_VOLUME = 0.5;
/** plant-bg.png 원본 비율 (473×1024) */
export const PLANT_BG_ASPECT = '473 / 1024';

/** 커피 단계(75~99%) — 카페 배경 + 커피 식물 이미지 */
export const COFFEE_STAGE_MIN = 75;
/** 커피마시기 단계(100%) — 카페 배경 전환 */
export const DRINK_STAGE_MIN = 100;

export const PLANT_SEED_SRC = '/images/plant/plant-seed.png?v=5';
export const PLANT_SPROUT_SRC = '/images/plant/plant-sprout.png?v=5';
export const PLANT_BEAN_SRC = '/images/plant/plant-bean.png?v=5';
export const PLANT_COFFEE_SRC = '/images/plant/plant-complete.png?v=5';
export const PLANT_DRINK_SRC = PLANT_COFFEE_SRC;

/** 상단 추천 버튼 이미지 — PNG로 교체 가능 */
export const RECOMMEND_BTN_WIDTH = 153;
export const RECOMMEND_BTN_HEIGHT = 85;
export const RECOMMEND_COFFEE_IMG = '/images/recommend/today-coffee.png?v=1';
export const RECOMMEND_DINNER_IMG = '/images/recommend/today-dinner.png?v=2';

export const STAGES = [
  { min: 0, label: '씨앗', emoji: '🫘', image: PLANT_SEED_SRC },
  { min: 25, label: '새싹', emoji: '🌱', image: PLANT_SPROUT_SRC },
  { min: 50, label: '원두', emoji: '☕', image: PLANT_BEAN_SRC },
  { min: 75, label: '커피', emoji: '✨', image: PLANT_COFFEE_SRC },
  { min: 100, label: '커피마시기', emoji: '☕', image: PLANT_DRINK_SRC },
] as const;

export type HoldMode = 'water' | 'brew' | 'drink';

export function randomWaterDurationSec() {
  const span = HOLD_MAX_SEC - HOLD_MIN_SEC + 1;
  return Math.floor(Math.random() * span) + HOLD_MIN_SEC;
}
