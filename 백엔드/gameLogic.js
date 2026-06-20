import { GOAL_AMOUNT, GROWTH_PER_WATER, SELL_PRICE, initialGameState } from './constants.js'

export function normalizeGameState(raw) {
  const totalWaters = raw?.totalWaters ?? raw?.totalTaps ?? 0

  return {
    growth: Number(raw?.growth ?? 0),
    money: Number(raw?.money ?? 0),
    totalCoffees: Number(raw?.totalCoffees ?? 0),
    totalWaters: Number(totalWaters),
    redeemed: Boolean(raw?.redeemed),
  }
}

export function applyWater(state) {
  const current = normalizeGameState(state)

  if (current.redeemed) {
    return { ok: false, reason: 'already-redeemed', state: current, lastEarned: null }
  }

  if (current.growth >= 100) {
    return { ok: false, reason: 'ready-to-drink', state: current, lastEarned: null }
  }

  const next = {
    ...current,
    growth: Math.min(100, current.growth + GROWTH_PER_WATER),
    totalWaters: current.totalWaters + 1,
  }

  return { ok: true, state: next, lastEarned: null }
}

export function applyDrink(state) {
  const current = normalizeGameState(state)

  if (current.redeemed) {
    return { ok: false, reason: 'already-redeemed', state: current, lastEarned: null }
  }

  if (current.growth < 100) {
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
  return { ok: true, state: { ...initialGameState } }
}
