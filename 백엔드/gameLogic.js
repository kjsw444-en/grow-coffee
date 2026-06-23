import { GOAL_AMOUNT, GROWTH_PER_WATER, SELL_PRICE, initialGameState } from './constants.js'
import {
  COFFEE_VARIANT_PURCHASE_COST,
  DEFAULT_COFFEE_VARIANT_SLUG,
  getAvailableCoffeeCups,
  getPurchasableCoffeeVariantSlugs,
  isCoffeeVariantSlug,
  normalizeOwnedCoffeeVariants,
  normalizeSelectedCoffeeVariant,
} from './coffeeVariants.js'
import {
  normalizePassiveQuota,
  repairGrowthAccrualSyncedAt,
  roundGrowth,
  syncPassiveQuota,
} from './passiveGrowth.js'
import {
  canWaterToday,
  consumeWaterQuota,
  grantAdWaterCredit,
  normalizeWaterQuota,
} from './waterQuota.js'

function sanitizeGrowthForWaters(growth, totalWaters) {
  const waters = Math.max(0, Math.floor(Number(totalWaters) || 0))
  const maxAllowed = Math.min(100, waters * GROWTH_PER_WATER)
  const value = roundGrowth(growth)
  const capped = Math.min(value, maxAllowed)
  const milestone = Math.floor(capped / GROWTH_PER_WATER) * GROWTH_PER_WATER
  return roundGrowth(Math.min(maxAllowed, milestone))
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
    growth: roundGrowth(raw?.growth ?? 0),
    money: Number(raw?.money ?? 0),
    totalCoffees: Number(raw?.totalCoffees ?? raw?.total_coffees ?? 0),
    totalWaters: Number(totalWaters ?? 0),
    redeemed: Boolean(raw?.redeemed),
    growthAccrualSyncedAt: repairGrowthAccrualSyncedAt(raw),
    selectedCoffeeVariant,
    ownedCoffeeVariants,
    spentCoffeeCups: Math.max(0, Math.floor(Number(raw?.spentCoffeeCups ?? raw?.spent_coffee_cups ?? 0))),
    ...passive,
    ...quota,
  }
}

/** DB/부트스트랩 로드 시 — 물주기 횟수 대비 growth 상한 보정 */
export function sanitizeLoadedGameState(raw) {
  const normalized = normalizeGameState(raw)

  return {
    ...normalized,
    growth: sanitizeGrowthForWaters(normalized.growth, normalized.totalWaters),
  }
}

function withSyncedQuota(state, now = new Date()) {
  return syncPassiveQuota(normalizeGameState(state), now)
}

export function applyWater(state) {
  const current = withSyncedQuota(state)

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
    growth: roundGrowth(Math.min(100, current.growth + GROWTH_PER_WATER)),
    totalWaters: current.totalWaters + 1,
  }

  return { ok: true, state: next, lastEarned: null }
}

/** DEV 전용 — 쿨다운·일일 물ota 없이 +25% (오류 테스트용) */
export function applyDevTestWater(state) {
  const current = withSyncedQuota(state)

  if (current.redeemed) {
    return { ok: false, reason: 'already-redeemed', state: current, lastEarned: null }
  }

  if (roundGrowth(current.growth) >= 100) {
    return { ok: false, reason: 'ready-to-drink', state: current, lastEarned: null }
  }

  const next = {
    ...current,
    growth: roundGrowth(Math.min(100, current.growth + GROWTH_PER_WATER)),
    totalWaters: current.totalWaters + 1,
  }

  return { ok: true, state: next, lastEarned: null }
}

export function applyWatchAd(state) {
  const current = withSyncedQuota(state)

  if (current.redeemed) {
    return { ok: false, reason: 'already-redeemed', state: current }
  }

  const nextQuota = grantAdWaterCredit(current)

  return {
    ok: true,
    state: { ...current, ...nextQuota },
  }
}

export function applyDrink(state) {
  const current = withSyncedQuota(state)

  if (current.redeemed) {
    return { ok: false, reason: 'already-redeemed', state: current, lastEarned: null }
  }

  if (roundGrowth(current.growth) < 100) {
    return { ok: false, reason: 'not-ready', state: current, lastEarned: null }
  }

  const nextMoney = current.money + SELL_PRICE
  const next = {
    ...current,
    growth: 0,
    money: nextMoney,
    totalCoffees: current.totalCoffees + 1,
    redeemed: nextMoney >= GOAL_AMOUNT,
  }

  return { ok: true, state: next, lastEarned: SELL_PRICE }
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
    }),
  }
}

export function applyPurchaseCoffeeVariant(state, slug) {
  const current = withSyncedQuota(state)
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
  const current = withSyncedQuota(state)
  const safeSlug = String(slug || '').trim()

  if (!isCoffeeVariantSlug(safeSlug)) {
    return { ok: false, reason: 'invalid-variant', state: current }
  }

  const owned = normalizeOwnedCoffeeVariants(current.ownedCoffeeVariants)
  if (!owned.includes(safeSlug)) {
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
