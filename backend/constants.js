import {
  DEFAULT_COFFEE_VARIANT_SLUG,
  normalizeOwnedCoffeeVariants,
  normalizeSelectedCoffeeVariant,
} from './coffeeVariants.js'

export const GOAL_AMOUNT = 4700
export const GROWTH_PER_WATER = 25
export const SELL_PRICE = 47
export const HOLD_MIN_SEC = 4
export const ACTION_COOLDOWN_MS = HOLD_MIN_SEC * 1000

/** 햇빛 방치 성장 — 하루 약 8%, 일일 캡 12% */
export const DAILY_PASSIVE_GROWTH_TARGET = 8
export const DAILY_PASSIVE_GROWTH_CAP = 12
export const PASSIVE_GROWTH_PER_SECOND = DAILY_PASSIVE_GROWTH_TARGET / 86400

export const initialGameState = {
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
  selectedCoffeeVariant: DEFAULT_COFFEE_VARIANT_SLUG,
  ownedCoffeeVariants: [DEFAULT_COFFEE_VARIANT_SLUG],
  spentCoffeeCups: 0,
}
