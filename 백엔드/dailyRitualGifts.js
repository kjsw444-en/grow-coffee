/** @typedef {'GIFT_COFFEE_2' | 'GIFT_PASSIVE_147' | 'GIFT_ROULETTE' | 'GIFT_SKIP_SEED'} RitualGiftId */

import { GROWTH_PER_WATER } from './constants.js'
import { grantBrewedCoffeeFields } from './brewedCoffeeReceived.js'
import { roundGrowth } from './passiveGrowth.js'

export const RITUAL_SKIP_SEED_MIN_GROWTH = GROWTH_PER_WATER

export const RITUAL_GIFT_DEFINITIONS = {
  GIFT_COFFEE_2: {
    weight: 25,
    label: '내린 커피 2잔',
    copyFortuneReveal: '오늘의 행운은 커피!\n내린 커피 2잔이 기다리고 있어!',
    copyOpened: '고양이가 내린 커피 2잔을 선물했어요!',
    reward: { type: 'coffee', cups: 2 },
  },
  GIFT_PASSIVE_147: {
    weight: 25,
    label: '방치 +47%',
    copyFortuneReveal: '오늘은 여유롭게!\n방치 속도가 47% 빨라져!',
    copyOpened: '오늘 하루 방치 커피 속도가 47% 빨라져요!',
    reward: { type: 'passiveBoost', multiplier: 1.47 },
  },
  GIFT_ROULETTE: {
    weight: 25,
    label: '룰렛 +1회',
    copyFortuneReveal: '오늘은 행운 가득!\n룰렛을 한 번 더 돌릴 수 있어!',
    copyOpened: '룰렛을 한 번 더 돌릴 수 있어요!',
    reward: { type: 'rouletteSpin', spins: 1 },
  },
  GIFT_SKIP_SEED: {
    weight: 25,
    label: '새싹부터 시작',
    copyFortuneReveal: '오늘은 빠른 성장!\n새싹부터 바로 시작할 수 있어!',
    copyOpened: '오늘은 씨앗 단계를 건너뛰고 새싹부터 자라요!',
    reward: { type: 'skipSeedStage' },
  },
}

export const RITUAL_GIFT_IDS = Object.keys(RITUAL_GIFT_DEFINITIONS)

export const RITUAL_FORTUNE_REVEAL_COPY = '고양이가 오늘의 선물을\n준비했어요!'

export function getRitualFortuneRevealCopy(giftId) {
  const def = getRitualGiftDefinition(giftId)
  return def?.copyFortuneReveal ?? RITUAL_FORTUNE_REVEAL_COPY
}

export function getRitualGiftDefinition(giftId) {
  return RITUAL_GIFT_DEFINITIONS[giftId] ?? null
}

export function pickRitualGiftId(seed) {
  const items = RITUAL_GIFT_IDS.map((id) => ({
    id,
    weight: RITUAL_GIFT_DEFINITIONS[id].weight,
  }))
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  const normalized = Number(seed) >>> 0
  let roll = (normalized / 0x100000000) * total

  for (const item of items) {
    roll -= item.weight
    if (roll <= 0) {
      return item.id
    }
  }

  return items[items.length - 1]?.id ?? 'GIFT_COFFEE_2'
}

export function hasRitualSkipSeedGift(state) {
  return (
    Boolean(state?.ritualGiftOpened ?? state?.ritual_gift_opened) &&
    String(state?.ritualGiftId ?? state?.ritual_gift_id ?? '') === 'GIFT_SKIP_SEED'
  )
}

export function getRitualGiftPassiveMultiplier(state) {
  if (
    Boolean(state?.ritualGiftOpened ?? state?.ritual_gift_opened) &&
    String(state?.ritualGiftId ?? state?.ritual_gift_id ?? '') === 'GIFT_PASSIVE_147'
  ) {
    return 1.47
  }

  return 1
}

export function applyRitualSkipSeedGrowthFloor(state) {
  if (!hasRitualSkipSeedGift(state)) {
    return state
  }

  const growth = roundGrowth(Math.min(100, Math.max(0, Number(state?.growth ?? 0))))
  if (growth >= RITUAL_SKIP_SEED_MIN_GROWTH) {
    return state
  }

  return {
    ...state,
    growth: RITUAL_SKIP_SEED_MIN_GROWTH,
  }
}

export function getRitualEffectiveGrowth(state, growth) {
  const value = roundGrowth(Math.min(100, Math.max(0, growth)))
  if (!hasRitualSkipSeedGift(state)) {
    return value
  }

  return Math.max(value, RITUAL_SKIP_SEED_MIN_GROWTH)
}

export function getRitualPostDrinkGrowth(state) {
  return hasRitualSkipSeedGift(state) ? RITUAL_SKIP_SEED_MIN_GROWTH : 0
}

export function applyRitualGiftReward(state, giftId) {
  const def = getRitualGiftDefinition(giftId)
  if (!def) {
    return state
  }

  const reward = def.reward
  let next = { ...state }

  switch (reward.type) {
    case 'coffee':
      next = {
        ...next,
        ...grantBrewedCoffeeFields(next, reward.cups),
      }
      break
    case 'passiveBoost':
      break
    case 'rouletteSpin':
      next = {
        ...next,
        ritualBonusRouletteSpins:
          Math.max(0, Number(next.ritualBonusRouletteSpins ?? 0)) + reward.spins,
      }
      break
    case 'skipSeedStage':
      next = applyRitualSkipSeedGrowthFloor(next)
      break
    default:
      break
  }

  return next
}
