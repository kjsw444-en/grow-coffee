import {
  BREWED_COFFEE_FINISH_BONUS_AMOUNT,
  BREWED_COFFEE_FINISH_BONUS_THRESHOLD,
  SELL_BATCH_REWARD,
  SELL_BATCH_SIZE,
} from './constants';/** 내린 커피 마시기 — 선택 가능 잔 수 (백엔드 constants.js 와 동기화) */
export const BREWED_COFFEE_DRINK_OPTIONS = [50, 100, 500, 1000, 2350] as const;
export { BREWED_COFFEE_FINISH_BONUS_AMOUNT, BREWED_COFFEE_FINISH_BONUS_THRESHOLD };

export type BrewedCoffeeDrinkOption = (typeof BREWED_COFFEE_DRINK_OPTIONS)[number];

export const MIN_BREWED_COFFEE_DRINK = BREWED_COFFEE_DRINK_OPTIONS[0];

export function getBrewedCoffeePointReward(cupCount: number) {
  const cups = Math.max(0, Math.floor(Number(cupCount) || 0));
  return Math.floor(cups * (SELL_BATCH_REWARD / SELL_BATCH_SIZE));
}

/** 어르신도 이해하기 쉬운 커피값 안내 */
export const BREWED_COFFEE_RATE_NOTICE =
  '아래 금액은 오늘 기준 커피값(포인트)입니다. 운영에 따라 잔당 커피값이 바뀔 수 있으니, 선택 전에 금액을 확인해 주세요.';

/** 「내린 커피 마시기」 버튼 안내 — 잔 수 조건 */
export function getBrewedCoffeeDrinkCupHint(totalCoffees: number) {
  const minCups = MIN_BREWED_COFFEE_DRINK;
  return `내린 커피 ${minCups.toLocaleString('ko-KR')}잔 이상 (현재 ${totalCoffees.toLocaleString('ko-KR')}잔)`;
}
