import type { CoffeeVariantSlug } from './coffeeVariants';

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
  selectedCoffeeVariant: CoffeeVariantSlug;
  ownedCoffeeVariants: CoffeeVariantSlug[];
  /** 상점에서 비운 커피잔 누적 — 랭킹 기준 */
  spentCoffeeCups: number;
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
  selectedCoffeeVariant: 'parttime-latte',
  ownedCoffeeVariants: ['parttime-latte'],
  spentCoffeeCups: 0,
};
