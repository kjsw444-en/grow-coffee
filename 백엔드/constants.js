import {
  DEFAULT_COFFEE_VARIANT_SLUG,
  normalizeOwnedCoffeeVariants,
  normalizeSelectedCoffeeVariant,
} from './coffeeVariants.js'

export const GOAL_AMOUNT = 4700
export const GROWTH_PER_WATER = 25
export const SELL_PRICE = 47
export const SELL_BATCH_SIZE = 10
export const SELL_BATCH_REWARD = 47
export const HOLD_MIN_SEC = 3
export const ACTION_COOLDOWN_MS = HOLD_MIN_SEC * 1000

/** 햇빛 방치 — 1분당 5%, 20분 = 100%, 하루 최대 2잔(200%) */
export const PASSIVE_GROWTH_PER_MINUTE = 5
export const PASSIVE_MINUTES_PER_CUP = 100 / PASSIVE_GROWTH_PER_MINUTE
export const PASSIVE_GROWTH_PER_SECOND = PASSIVE_GROWTH_PER_MINUTE / 60
export const DAILY_PASSIVE_GROWTH_CAP = 200

/** 토스 공유 리워드 — contactsViral moduleId, 지급 내린 커피 */
export const SHARE_REWARD_MODULE_ID = 'd2b00c15-3de1-437f-82b6-af3d1d87eb46'
export const SHARE_REWARD_COFFEE_AMOUNT = 50

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
  passiveCoffeesClaimed: 0,
  selectedCoffeeVariant: DEFAULT_COFFEE_VARIANT_SLUG,
  ownedCoffeeVariants: [DEFAULT_COFFEE_VARIANT_SLUG],
  spentCoffeeCups: 0,
  shareRewardDayKey: '',
  passiveReactivateDayKey: '',
}
