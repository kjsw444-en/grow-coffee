import {
  GOAL_AMOUNT,
  GROWTH_PER_WATER,
  SELL_BATCH_REWARD,
  SELL_BATCH_SIZE,
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
  grantAdWaterCredit,
  needsAdForWater,
  normalizeWaterQuota,
} from './waterQuota.js'
import { hasClaimedShareRewardToday, markShareRewardClaimed } from './shareReward.js'
import { hasUsedPassiveReactivateToday, markPassiveReactivateUsed } from './passiveReactivate.js'

function clampGrowth(growth) {
  return roundGrowth(Math.min(100, Math.max(0, growth)))
}

export function normalizeGameState(raw) {
  const totalWaters = raw?.totalWaters ?? raw?.totalTaps ?? raw?.total_waters ?? 0
  const quota = normalizeWaterQuota(raw)
  const passive = normalizePassiveQuota(raw)
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
    shareRewardDayKey: String(raw?.shareRewardDayKey ?? raw?.share_reward_day_key ?? ''),
    passiveReactivateDayKey: String(
      raw?.passiveReactivateDayKey ?? raw?.passive_reactivate_day_key ?? '',
    ),
    ...passive,
    ...quota,
  }
}

/** DB/부트스트랩 로드 시 — growth 0~100%만 보정 */
export function sanitizeLoadedGameState(raw) {
  const normalized = normalizeGameState(raw)

  return {
    ...normalized,
    growth: clampGrowth(normalized.growth),
  }
}

function withSettledPassive(state, now = new Date()) {
  return settlePassiveGrowth(normalizeGameState(state), now)
}

export function applyWater(state) {
  const current = withSettledPassive(state)

  if (current.redeemed) {
    return { ok: false, reason: 'already-redeemed', state: current, lastEarned: null }
  }

  if (current.growth >= 100) {
    return { ok: false, reason: 'ready-to-drink', state: current, lastEarned: null }
  }

  if (!canWaterToday(current)) {
    return { ok: false, reason: 'need-ad', state: current, lastEarned: null }
  }

  const nextQuota = consumeWaterQuota(current)
  const next = {
    ...current,
    ...nextQuota,
    growth: clampGrowth(current.growth + GROWTH_PER_WATER),
    totalWaters: current.totalWaters + 1,
  }

  return { ok: true, state: next, lastEarned: null }
}

/** DEV 전용 — 쿨다운·일일 물ota 없이 +25% (오류 테스트용) */
export function applyDevTestWater(state) {
  const current = withSettledPassive(state)

  if (current.redeemed) {
    return { ok: false, reason: 'already-redeemed', state: current, lastEarned: null }
  }

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

  if (current.redeemed) {
    return { ok: false, reason: 'already-redeemed', state: current }
  }

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

  if (current.redeemed) {
    return { ok: false, reason: 'already-redeemed', state: current }
  }

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

  if (current.redeemed) {
    return { ok: false, reason: 'already-redeemed', state: current, rewardAmount: 0 }
  }

  if (hasClaimedShareRewardToday(current)) {
    return { ok: false, reason: 'already-claimed', state: current, rewardAmount: 0 }
  }

  const next = {
    ...current,
    ...markShareRewardClaimed(current),
    totalCoffees: current.totalCoffees + SHARE_REWARD_COFFEE_AMOUNT,
  }

  return {
    ok: true,
    state: next,
    rewardAmount: SHARE_REWARD_COFFEE_AMOUNT,
  }
}

export function applyClaimPassiveCoffee(state) {
  const current = withSettledPassive(state)

  if (current.redeemed) {
    return { ok: false, reason: 'already-redeemed', state: current, lastEarned: null }
  }

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
    totalCoffees: current.totalCoffees + 1,
    dailyPassiveGrowth: previewDaily,
    growthAccrualSyncedAt: now,
  }

  return { ok: true, state: next, lastEarned: 1 }
}

export function applyReactivatePassiveCoffee(state) {
  const current = withSettledPassive(state)

  if (current.redeemed) {
    return { ok: false, reason: 'already-redeemed', state: current }
  }

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

export function applyDrink(state) {
  const current = withSettledPassive(state)

  if (current.redeemed) {
    return { ok: false, reason: 'already-redeemed', state: current, lastEarned: null }
  }

  if (roundGrowth(current.growth) < 100) {
    return { ok: false, reason: 'not-ready', state: current, lastEarned: null }
  }

  const next = {
    ...current,
    growth: 0,
    totalCoffees: current.totalCoffees + 1,
    growthAccrualSyncedAt: new Date().toISOString(),
  }

  return { ok: true, state: next, lastEarned: null }
}

export function applySellBatch(state) {
  const current = withSettledPassive(state)

  if (current.redeemed) {
    return { ok: false, reason: 'already-redeemed', state: current, lastEarned: null }
  }

  if (current.totalCoffees < SELL_BATCH_SIZE) {
    return { ok: false, reason: 'not-enough-cups', state: current, lastEarned: null }
  }

  const nextMoney = current.money + SELL_BATCH_REWARD

  return {
    ok: true,
    state: {
      ...current,
      totalCoffees: current.totalCoffees - SELL_BATCH_SIZE,
      money: nextMoney,
      redeemed: nextMoney >= GOAL_AMOUNT,
    },
    lastEarned: SELL_BATCH_REWARD,
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

export function applyReset() {
  return {
    ok: true,
    state: normalizeGameState({
      ...initialGameState,
      growthAccrualSyncedAt: new Date().toISOString(),
      passiveDayKey: getPassiveDayKey(),
      passiveReactivateDayKey: '',
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
      totalCoffees: Math.max(0, current.totalCoffees - COFFEE_VARIANT_PURCHASE_COST),
      spentCoffeeCups: current.spentCoffeeCups + COFFEE_VARIANT_PURCHASE_COST,
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
