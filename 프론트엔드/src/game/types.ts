import type { CoffeeVariantSlug } from './coffeeVariants';
import type { SelectedCoffeeSlug } from './hiddenCoffeeVariants';

export type GameState = {
  growth: number;
  money: number;
  totalCoffees: number;
  totalWaters: number;
  redeemed: boolean;
  waterDayKey: string;
  watersToday: number;
  adWaterCredits: number;
  growthAccrualSyncedAt: string;
  passiveDayKey: string;
  dailyPassiveGrowth: number;
  /** 오늘 방치 커피 받기로 수령한 잔 수 (0~2) */
  passiveCoffeesClaimed: number;
  selectedCoffeeVariant: SelectedCoffeeSlug;
  ownedCoffeeVariants: CoffeeVariantSlug[];
  /** 상점에서 비운 커피잔 누적 — 랭킹 기준 */
  spentCoffeeCups: number;
  /** 마지막 공유 리워드 수령일 (KST en-CA) */
  shareRewardDayKey: string;
  /** 방치 커피 재활성(광고) 사용일 — 하루 1회 */
  passiveReactivateDayKey: string;
};

export const initialState: GameState = {
  growth: 0,
  money: 0,
  totalCoffees: 0,
  totalWaters: 0,
  redeemed: false,
  waterDayKey: '',
  watersToday: 0,
  adWaterCredits: 0,
  growthAccrualSyncedAt: new Date().toISOString(),
  passiveDayKey: '',
  dailyPassiveGrowth: 0,
  passiveCoffeesClaimed: 0,
  selectedCoffeeVariant: 'parttime-latte',
  ownedCoffeeVariants: ['parttime-latte'],
  spentCoffeeCups: 0,
  shareRewardDayKey: '',
  passiveReactivateDayKey: '',
};
