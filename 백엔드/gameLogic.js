import {
  GOAL_AMOUNT,
  GROWTH_PER_WATER,
  BREWED_COFFEE_FINISH_BONUS_AMOUNT,
  BREWED_COFFEE_FINISH_BONUS_THRESHOLD,
  SELL_BATCH_REWARD,
  SELL_BATCH_SIZE,
  BREWED_COFFEE_DRINK_OPTIONS,
  TREE_HARVEST_REWARD_TABLE,
  getBrewedCoffeePointReward,
  SHARE_REWARD_COFFEE_AMOUNT,
  DAILY_PASSIVE_GROWTH_CAP,
  initialGameState,
} from './constants.js'
import {
  COFFEE_VARIANT_PURCHASE_COST,
  DEFAULT_COFFEE_VARIANT_SLUG,
  getAvailableCoffeeCups,
  getPurchasableCoffeeVariantSlugs,
  isCoffeeVariantSlug,
  normalizeOwnedCoffeeVariants,
  normalizeSelectedCoffeeVariant,
} from './coffeeVariants.js'
import { isHiddenCoffeeUnlocked, isHiddenCoffeeVariantSlug } from './hiddenCoffeeVariants.js'
import {
  normalizePassiveQuota,
  repairGrowthAccrualSyncedAt,
  roundGrowth,
  settlePassiveGrowth,
  getPassiveDayKey,
  getPassiveGrowthAccrualCap,
} from './passiveGrowth.js'
import {
  canWaterToday,
  consumeWaterQuota,
  getTodayKey,
  grantAdWaterCredit,
  needsAdForWater,
  normalizeWaterQuota,
} from './waterQuota.js'
import { hasClaimedShareRewardToday, markShareRewardClaimed } from './shareReward.js'
import { hasUsedPassiveReactivateToday, markPassiveReactivateUsed } from './passiveReactivate.js'
import { normalizeMinigameRewardMask } from './minigameReward.js'
import {
  applyAttendanceFromTreeHarvest,
  applyClaimAttendanceDailyReward,
  applyClaimAttendanceStreakBonus as claimAttendanceStreakBonusRaw,
  normalizeAttendance,
} from './attendance.js'
import {
  DAILY_POINT_CAP,
  getDailyPointRoom,
  normalizePointDayKey,
  settleDailyPoint,
} from './dailyPoint.js'
import { normalizeDailyRitual } from './dailyRitual.js'
import { normalizeMenuRecommendations } from './menuRecommendations.js'
import {
  consumeRitualFertilizerCharge,
  getRitualWaterGrowthDelta,
} from './dailyRitualFortunes.js'
import { getRitualPostDrinkGrowth } from './dailyRitualGifts.js'
import { onRitualHarvest } from './dailyRitualMissions.js'
import {
  applyBrewedCoffeeDeltaFields,
  grantBrewedCoffeeFields,
  getDailyRankingReceived,
  getRankingReceived,
  normalizeDailyBrewedReceived,
} from './brewedCoffeeReceived.js'

function clampGrowth(growth) {
  return roundGrowth(Math.min(100, Math.max(0, growth)))
}

export function normalizeGameState(raw) {
  const totalWaters = raw?.totalWaters ?? raw?.totalTaps ?? raw?.total_waters ?? 0
  const quota = normalizeWaterQuota(raw)
  const passive = normalizePassiveQuota(raw)
  const minigameRewards = normalizeMinigameRewardMask(raw)
  const ownedCoffeeVariants = normalizeOwnedCoffeeVariants(
    raw?.ownedCoffeeVariants ?? raw?.owned_coffee_variants,
  )
  const selectedCoffeeVariant = normalizeSelectedCoffeeVariant(
    raw?.selectedCoffeeVariant ?? raw?.selected_coffee_variant,
    ownedCoffeeVariants,
  )

  return {
    growth: clampGrowth(raw?.growth ?? 0),
    money: Number(raw?.money ?? 0),
    totalCoffees: Number(raw?.totalCoffees ?? raw?.total_coffees ?? 0),
    totalWaters: Number(totalWaters ?? 0),
    redeemed: Boolean(raw?.redeemed),
    growthAccrualSyncedAt: repairGrowthAccrualSyncedAt(raw),
    selectedCoffeeVariant,
    ownedCoffeeVariants,
    spentCoffeeCups: Math.max(0, Math.floor(Number(raw?.spentCoffeeCups ?? raw?.spent_coffee_cups ?? 0))),
    lifetimeDrunkCoffees: Math.max(
      0,
      Math.floor(Number(raw?.lifetimeDrunkCoffees ?? raw?.lifetime_drunk_coffees ?? 0)),
    ),
    lifetimeBrewedSpent: Math.max(
      0,
      Math.floor(
        Number(
          raw?.lifetimeBrewedSpent ??
            raw?.lifetime_brewed_spent ??
            raw?.lifetimeDrunkCoffees ??
            raw?.lifetime_drunk_coffees ??
            0,
        ),
      ),
    ),
    dailyBrewedSpentDayKey: String(
      raw?.dailyBrewedSpentDayKey ?? raw?.daily_brewed_spent_day_key ?? '',
    ),
    dailyBrewedSpent: Math.max(
      0,
      Math.floor(Number(raw?.dailyBrewedSpent ?? raw?.daily_brewed_spent ?? 0)),
    ),
    shareRewardDayKey: String(raw?.shareRewardDayKey ?? raw?.share_reward_day_key ?? ''),
    passiveReactivateDayKey: String(
      raw?.passiveReactivateDayKey ?? raw?.passive_reactivate_day_key ?? '',
    ),
    ...minigameRewards,
    ...passive,
    ...quota,
    ...normalizeAttendance(raw),
    ...normalizeDailyBrewedReceived(raw),
    pointDayKey: normalizePointDayKey(raw),
    dailyLoginRouletteDayKey: String(
      raw?.dailyLoginRouletteDayKey ?? raw?.daily_login_roulette_day_key ?? '',
    ),
    dailyLoginRouletteRewardCups: Math.max(
      0,
      Number(raw?.dailyLoginRouletteRewardCups ?? raw?.daily_login_roulette_reward_cups ?? 0),
    ),
    dailyLoginRouletteRespinDayKey: String(
      raw?.dailyLoginRouletteRespinDayKey ?? raw?.daily_login_roulette_respin_day_key ?? '',
    ),
    ...normalizeDailyRitual(raw),
    ...normalizeMenuRecommendations(raw),
  }
}

/** DB/부트스트랩 로드 시 — growth 0~100%만 보정 */
export function sanitizeLoadedGameState(raw) {
  const normalized = withSettledDailyPoint(normalizeGameState(raw))

  return {
    ...normalized,
    growth: clampGrowth(normalized.growth),
  }
}

function withSettledPassive(state, now = new Date()) {
  return settlePassiveGrowth(normalizeGameState(state), now)
}

function withSettledDailyPoint(state, now = new Date()) {
  return settleDailyPoint(withSettledPassive(state, now), now)
}

export function applyWater(state) {
  const current = withSettledPassive(state)

  if (current.growth >= 100) {
    return { ok: false, reason: 'ready-to-drink', state: current, lastEarned: null }
  }

  if (!canWaterToday(current)) {
    return { ok: false, reason: 'need-ad', state: current, lastEarned: null }
  }

  const nextQuota = consumeWaterQuota(current)
  const waterDelta = getRitualWaterGrowthDelta(current, GROWTH_PER_WATER)
  let next = {
    ...current,
    ...nextQuota,
    growth: clampGrowth(current.growth + waterDelta),
    totalWaters: current.totalWaters + 1,
  }

  if (Math.max(0, Number(current.ritualFertilizerCharges ?? 0)) > 0) {
    next = consumeRitualFertilizerCharge(next)
  }

  return { ok: true, state: next, lastEarned: null }
}

/** DEV 전용 — 쿨다운·일일 물ota 없이 +25% (오류 테스트용) */
export function applyDevTestWater(state) {
  const current = withSettledPassive(state)

  if (roundGrowth(current.growth) >= 100) {
    return { ok: false, reason: 'ready-to-drink', state: current, lastEarned: null }
  }

  const next = {
    ...current,
    growth: clampGrowth(current.growth + GROWTH_PER_WATER),
    totalWaters: current.totalWaters + 1,
  }

  return { ok: true, state: next, lastEarned: null }
}

/** DEV 전용 — 방치 커피 게이지 +100% (서버 저장) */
export function applyDevBumpPassive(state) {
  const current = withSettledPassive(state)

  const maxCups = Math.floor(DAILY_PASSIVE_GROWTH_CAP / 100) || 2
  const claimed = Math.max(0, Math.floor(current.passiveCoffeesClaimed ?? 0))

  if (claimed >= maxCups) {
    return { ok: false, reason: 'daily-limit', state: current }
  }

  const now = new Date().toISOString()
  const accrualCap = getPassiveGrowthAccrualCap(claimed, DAILY_PASSIVE_GROWTH_CAP)

  return {
    ok: true,
    state: {
      ...current,
      dailyPassiveGrowth: roundGrowth(
        Math.min(accrualCap, current.dailyPassiveGrowth + 100),
      ),
      growthAccrualSyncedAt: now,
    },
  }
}

export function applyWatchAd(state) {
  const current = withSettledPassive(state)

  if (!needsAdForWater(current)) {
    return { ok: false, reason: 'not-needed', state: current }
  }

  const nextQuota = grantAdWaterCredit(current)

  return {
    ok: true,
    state: { ...current, ...nextQuota },
  }
}

export function applyShareReward(state) {
  const current = withSettledPassive(state)

  if (hasClaimedShareRewardToday(current)) {
    return { ok: false, reason: 'already-claimed', state: current, rewardAmount: 0 }
  }

  const next = {
    ...current,
    ...markShareRewardClaimed(current),
    ...grantBrewedCoffeeFields(current, SHARE_REWARD_COFFEE_AMOUNT),
  }

  return {
    ok: true,
    state: next,
    rewardAmount: SHARE_REWARD_COFFEE_AMOUNT,
  }
}

export function applyClaimPassiveCoffee(state) {
  const current = withSettledPassive(state)

  const claimed = Math.max(0, Math.floor(current.passiveCoffeesClaimed ?? 0))
  const previewDaily = roundGrowth(current.dailyPassiveGrowth)
  const unclaimed = roundGrowth(Math.max(0, previewDaily - claimed * 100))

  if (unclaimed < 100) {
    return { ok: false, reason: 'not-ready', state: current, lastEarned: null }
  }

  const maxCups = Math.floor(DAILY_PASSIVE_GROWTH_CAP / 100) || 2
  if (claimed >= maxCups) {
    return { ok: false, reason: 'daily-limit', state: current, lastEarned: null }
  }

  const now = new Date().toISOString()

  const next = {
    ...current,
    passiveCoffeesClaimed: claimed + 1,
    ...grantBrewedCoffeeFields(current, 1),
    dailyPassiveGrowth: previewDaily,
    growthAccrualSyncedAt: now,
  }

  return { ok: true, state: next, lastEarned: 1 }
}

export function applyReactivatePassiveCoffee(state) {
  const current = withSettledPassive(state)

  const maxCups = Math.floor(DAILY_PASSIVE_GROWTH_CAP / 100) || 2
  const claimed = Math.max(0, Math.floor(current.passiveCoffeesClaimed ?? 0))

  if (claimed < maxCups) {
    return { ok: false, reason: 'not-complete', state: current }
  }

  if (hasUsedPassiveReactivateToday(current)) {
    return { ok: false, reason: 'already-reactivated', state: current }
  }

  const today = getPassiveDayKey()
  const now = new Date().toISOString()

  const next = {
    ...current,
    ...markPassiveReactivateUsed(current),
    passiveDayKey: today,
    dailyPassiveGrowth: 0,
    passiveCoffeesClaimed: 0,
    growthAccrualSyncedAt: now,
  }

  return { ok: true, state: next }
}

/** 내린 커피(totalCoffees) 소모량만큼 마신 커피·출석 누적 증가 */
function addDrunkCoffeeFromBrewedSpend(state, brewedAmount) {
  const amount = Math.max(0, Math.floor(Number(brewedAmount) || 0))
  const today = getTodayKey()
  const currentDaily =
    state.dailyBrewedSpentDayKey === today ? Math.max(0, Math.floor(Number(state.dailyBrewedSpent) || 0)) : 0

  return {
    spentCoffeeCups: state.spentCoffeeCups + amount,
    lifetimeDrunkCoffees: state.lifetimeDrunkCoffees + amount,
    lifetimeBrewedSpent: (state.lifetimeBrewedSpent ?? 0) + amount,
    dailyBrewedSpentDayKey: today,
    dailyBrewedSpent: currentDaily + amount,
  }
}

/** 랭킹 점수 — 오늘 받은 내린 커피 잔 수 */
export function getRankingBrewedSpend(state, date = new Date()) {
  return getRankingReceived(state, date)
}

/** 일일 랭킹 점수 — KST 오늘 받은 내린 커피 잔 수 */
export function getDailyRankingBrewedSpend(state, date = new Date()) {
  return getDailyRankingReceived(state, date)
}

export { getDailyRankingReceived, grantBrewedCoffeeFields, applyBrewedCoffeeDeltaFields }

export function pickTreeHarvestRewardCups(randomValue = Math.random()) {
  const totalWeight = TREE_HARVEST_REWARD_TABLE.reduce((sum, reward) => sum + reward.weight, 0)
  const roll = Math.min(0.999999, Math.max(0, Number(randomValue) || 0)) * totalWeight
  let cursor = 0

  for (const reward of TREE_HARVEST_REWARD_TABLE) {
    cursor += reward.weight
    if (roll < cursor) {
      return reward.cups
    }
  }

  return TREE_HARVEST_REWARD_TABLE[0]?.cups ?? 1
}

export function applyDrink(state, options = {}) {
  const current = withSettledPassive(state)

  if (roundGrowth(current.growth) < 100) {
    return { ok: false, reason: 'not-ready', state: current, lastEarned: null }
  }

  const attendanceResult = applyAttendanceFromTreeHarvest(current)
  const rewardCups = pickTreeHarvestRewardCups(options.randomValue ?? Math.random())

  let next = {
    ...current,
    growth: getRitualPostDrinkGrowth(current),
    growthAccrualSyncedAt: new Date().toISOString(),
    ...grantBrewedCoffeeFields(current, rewardCups),
    ...attendanceResult.attendance,
  }

  next = onRitualHarvest(next)

  return {
    ok: true,
    state: next,
    lastEarned: rewardCups,
    attendanceGoalJustMet: attendanceResult.goalJustMet,
  }
}

export function applySellBatch(state, cupCount = SELL_BATCH_SIZE) {
  const current = withSettledDailyPoint(state)
  const batchSize = Math.floor(Number(cupCount) || 0)

  if (!BREWED_COFFEE_DRINK_OPTIONS.includes(batchSize)) {
    return { ok: false, reason: 'invalid-batch-size', state: current, lastEarned: null }
  }

  if (current.totalCoffees < batchSize) {
    return { ok: false, reason: 'not-enough-cups', state: current, lastEarned: null }
  }

  const room = getDailyPointRoom(current)
  if (room <= 0) {
    return { ok: false, reason: 'daily-point-cap-reached', state: current, lastEarned: null }
  }

  const reward = Math.min(getBrewedCoffeePointReward(batchSize), room)
  const nextMoney = current.money + reward
  const dailyCapJustReached = nextMoney >= DAILY_POINT_CAP && current.money < DAILY_POINT_CAP

  return {
    ok: true,
    state: normalizeGameState({
      ...current,
      totalCoffees: current.totalCoffees - batchSize,
      ...addDrunkCoffeeFromBrewedSpend(current, batchSize),
      money: nextMoney,
      attendanceDayKey: current.attendanceDayKey,
      attendanceCupsToday: current.attendanceCupsToday,
      attendanceStreak: current.attendanceStreak,
      attendanceLastGoalDayKey: current.attendanceLastGoalDayKey,
      attendanceDailyClaimDayKey: current.attendanceDailyClaimDayKey,
      attendanceStreakBonusPending: current.attendanceStreakBonusPending,
    }),
    lastEarned: reward,
    dailyCapJustReached,
  }
}

export function applyClaimBrewedCoffeeFinishBonus(state) {
  const current = withSettledPassive(state)

  if (current.totalCoffees >= SELL_BATCH_SIZE) {
    return { ok: false, reason: 'already-ready', state: current, rewardCups: 0 }
  }

  if (current.totalCoffees < BREWED_COFFEE_FINISH_BONUS_THRESHOLD) {
    return { ok: false, reason: 'not-close-enough', state: current, rewardCups: 0 }
  }

  return {
    ok: true,
    state: normalizeGameState({
      ...current,
      ...grantBrewedCoffeeFields(current, BREWED_COFFEE_FINISH_BONUS_AMOUNT),
    }),
    rewardCups: BREWED_COFFEE_FINISH_BONUS_AMOUNT,
  }
}

export function applyRedeem(state) {
  const current = normalizeGameState(state)

  if (current.redeemed) {
    return { ok: false, reason: 'already-redeemed', state: current }
  }

  if (current.money < GOAL_AMOUNT) {
    return { ok: false, reason: 'not-enough-money', state: current }
  }

  return {
    ok: true,
    state: { ...current, redeemed: true },
    rewardAmount: GOAL_AMOUNT,
  }
}

export function applyReset(state) {
  const current = normalizeGameState(state ?? {})
  return {
    ok: true,
    state: normalizeGameState({
      ...initialGameState,
      growthAccrualSyncedAt: new Date().toISOString(),
      passiveDayKey: getPassiveDayKey(),
      passiveReactivateDayKey: '',
      dailyLoginRouletteDayKey: current.dailyLoginRouletteDayKey,
      dailyLoginRouletteRewardCups: current.dailyLoginRouletteRewardCups,
      dailyLoginRouletteRespinDayKey: current.dailyLoginRouletteRespinDayKey,
    }),
  }
}

export function applyPurchaseCoffeeVariant(state, slug) {
  const current = withSettledPassive(state)
  const safeSlug = String(slug || '').trim()

  if (!isCoffeeVariantSlug(safeSlug)) {
    return { ok: false, reason: 'invalid-variant', state: current }
  }

  if (safeSlug === DEFAULT_COFFEE_VARIANT_SLUG) {
    return { ok: false, reason: 'already-free', state: current }
  }

  if (!getPurchasableCoffeeVariantSlugs().includes(safeSlug)) {
    return { ok: false, reason: 'invalid-variant', state: current }
  }

  const owned = normalizeOwnedCoffeeVariants(current.ownedCoffeeVariants)
  if (owned.includes(safeSlug)) {
    return { ok: false, reason: 'already-owned', state: current }
  }

  if (getAvailableCoffeeCups(current) < COFFEE_VARIANT_PURCHASE_COST) {
    return { ok: false, reason: 'not-enough-cups', state: current }
  }

  return {
    ok: true,
    state: normalizeGameState({
      ...current,
      ownedCoffeeVariants: [...owned, safeSlug],
      spentCoffeeCups: Math.max(0, current.spentCoffeeCups - COFFEE_VARIANT_PURCHASE_COST),
      selectedCoffeeVariant: safeSlug,
    }),
  }
}

export function applySelectCoffeeVariant(state, slug) {
  const current = withSettledPassive(state)
  const safeSlug = String(slug || '').trim()
  const owned = normalizeOwnedCoffeeVariants(current.ownedCoffeeVariants)

  if (isHiddenCoffeeVariantSlug(safeSlug)) {
    if (!isHiddenCoffeeUnlocked(safeSlug, owned)) {
      return { ok: false, reason: 'not-owned', state: current }
    }
  } else if (!isCoffeeVariantSlug(safeSlug)) {
    return { ok: false, reason: 'invalid-variant', state: current }
  } else if (!owned.includes(safeSlug)) {
    return { ok: false, reason: 'not-owned', state: current }
  }

  if (current.selectedCoffeeVariant === safeSlug) {
    return { ok: true, state: current }
  }

  return {
    ok: true,
    state: normalizeGameState({
      ...current,
      selectedCoffeeVariant: safeSlug,
    }),
  }
}

export function applyClaimAttendanceDaily(state) {
  const result = applyClaimAttendanceDailyReward(state)

  if (!result.ok) {
    return { ok: false, reason: result.reason, state: normalizeGameState(result.state) }
  }

  return {
    ok: true,
    state: normalizeGameState(result.state),
    rewardCups: result.rewardCups,
  }
}

export function applyClaimAttendanceStreakBonus(state) {
  const result = claimAttendanceStreakBonusRaw(state)

  if (!result.ok) {
    return { ok: false, reason: result.reason, state: normalizeGameState(result.state) }
  }

  return {
    ok: true,
    state: normalizeGameState(result.state),
    rewardCups: result.rewardCups,
  }
}
