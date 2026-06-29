import {
  DEFAULT_COFFEE_VARIANT_SLUG,
  normalizeOwnedCoffeeVariants,
  normalizeSelectedCoffeeVariant,
} from './coffeeVariants.js'

export const GOAL_AMOUNT = 4700
export const GROWTH_PER_WATER = 25
export const SELL_PRICE = 47
export const SELL_BATCH_SIZE = 50
export const SELL_BATCH_REWARD = 100
export const BREWED_COFFEE_FINISH_BONUS_THRESHOLD = 48
export const BREWED_COFFEE_FINISH_BONUS_AMOUNT = 2
/** 내린 커피 마시기 — 선택 가능 잔 수 */
export const BREWED_COFFEE_DRINK_OPTIONS = [50, 100, 500, 1000, 2350]
export const TREE_HARVEST_REWARD_TABLE = [
  { cups: 1, weight: 70 },
  { cups: 2, weight: 20 },
  { cups: 3, weight: 7 },
  { cups: 4, weight: 2 },
  { cups: 5, weight: 1 },
]

export function getBrewedCoffeePointReward(cupCount) {
  const cups = Math.max(0, Math.floor(Number(cupCount) || 0))
  return Math.floor(cups * (SELL_BATCH_REWARD / SELL_BATCH_SIZE))
}
export const HOLD_MIN_SEC = 2
export const HOLD_MAX_SEC = 2
/** 연속 /water 방지 — 홀드 완료 후 1회만 호출되므로 짧게 유지 */
export const ACTION_COOLDOWN_MS = 400

/** 햇빛 방치 — 1분당 5%, 20분 = 100%, 하루 최대 2잔(200%) */
export const PASSIVE_GROWTH_PER_MINUTE = 5
export const PASSIVE_MINUTES_PER_CUP = 100 / PASSIVE_GROWTH_PER_MINUTE
export const PASSIVE_GROWTH_PER_SECOND = PASSIVE_GROWTH_PER_MINUTE / 60
export const DAILY_PASSIVE_GROWTH_CAP = 200

/** 토스 공유 리워드 — contactsViral moduleId, 지급 내린 커피 */
export const SHARE_REWARD_MODULE_ID = 'd2b00c15-3de1-437f-82b6-af3d1d87eb46'
export const SHARE_REWARD_COFFEE_AMOUNT = 25

/** 출석 — 커피나무 100% 수확 하루 목표·연속 보너스 */
export const ATTENDANCE_DAILY_GOAL = 3
export const ATTENDANCE_DAILY_REWARD = 5
export const ATTENDANCE_STREAK_TARGET = 7
export const ATTENDANCE_STREAK_BONUS = 10

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
  lifetimeDrunkCoffees: 0,
  lifetimeBrewedSpent: 0,
  dailyBrewedSpentDayKey: '',
  dailyBrewedSpent: 0,
  dailyBrewedReceivedDayKey: '',
  dailyBrewedReceived: 0,
  shareRewardDayKey: '',
  passiveReactivateDayKey: '',
  minigameRewardDayKey: '',
  minigameRewardFreeMask: 0,
  minigameRewardAdMask: 0,
  attendanceDayKey: '',
  attendanceCupsToday: 0,
  attendanceStreak: 0,
  attendanceLastGoalDayKey: '',
  attendanceDailyClaimDayKey: '',
  attendanceStreakBonusPending: false,
  pointDayKey: '',
  dailyLoginRouletteDayKey: '',
  dailyLoginRouletteRewardCups: 0,
  dailyLoginRouletteRespinDayKey: '',
  ritualDayKey: '',
  ritualFortuneId: '',
  ritualFortuneRevealed: false,
  ritualFortuneProgress: 0,
  ritualFortuneClaimed: false,
  ritualGiftOpened: false,
  ritualGiftId: '',
  ritualMission1Id: '',
  ritualMission2Id: '',
  ritualMission3Id: '',
  ritualMission1Done: false,
  ritualMission2Done: false,
  ritualMission3Done: false,
  ritualMissionClaimed: false,
  ritualMissionHarvestCount: 0,
  ritualMissionMinigameDone: false,
  ritualMissionRouletteDone: false,
  ritualFertilizerCharges: 0,
  ritualBonusRouletteSpins: 0,
  recommendCoffeeRerollDayKey: '',
  recommendDinnerRerollDayKey: '',
}
