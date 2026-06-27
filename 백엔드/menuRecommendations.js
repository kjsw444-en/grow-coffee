import { getTodayKey } from './waterQuota.js'
import { ritualSeed } from './dailyRitual.js'

export const COFFEE_MENU_IDS = [
  'iced-americano',
  'cafe-latte',
  'vanilla-latte',
  'caramel-macchiato',
  'dolce-latte',
  'hazelnut-latte',
  'cold-brew',
  'cold-brew-latte',
  'cafe-mocha',
  'einspanner',
  'brown-sugar-coffee',
  'decaf-latte',
]

export const DINNER_MENU_IDS = [
  'jeyuk-bokkeum',
  'samgyeopsal',
  'dak-galbi',
  'so-bulgogi',
  'shabu-shabu',
  'salmon-donburi',
  'hoe-deopbap',
  'kimchi-jjigae',
  'doenjang-jjigae',
  'sundubu-jjigae',
  'bibimbap',
  'ojingeo-bokkeum',
]

const KIND_CONFIG = {
  coffee: {
    rerollDayKey: 'recommendCoffeeRerollDayKey',
    menuIds: COFFEE_MENU_IDS,
  },
  dinner: {
    rerollDayKey: 'recommendDinnerRerollDayKey',
    menuIds: DINNER_MENU_IDS,
  },
}

export function normalizeRecommendKind(raw) {
  const kind = String(raw ?? '').trim().toLowerCase()
  return kind === 'coffee' || kind === 'dinner' ? kind : null
}

/** DB에는 「한번 더」 사용일만 저장 — 메뉴 ID는 유저·날짜로 매번 계산 */
export function normalizeMenuRecommendations(raw) {
  return {
    recommendCoffeeRerollDayKey: String(
      raw?.recommendCoffeeRerollDayKey ?? raw?.recommend_coffee_reroll_day_key ?? '',
    ),
    recommendDinnerRerollDayKey: String(
      raw?.recommendDinnerRerollDayKey ?? raw?.recommend_dinner_reroll_day_key ?? '',
    ),
  }
}

export function getPrimaryMenuId(userId, kind, dateKey = getTodayKey()) {
  const menuIds = KIND_CONFIG[kind].menuIds
  const seed = ritualSeed(userId, dateKey, `recommend:${kind}`)
  return menuIds[seed % menuIds.length]
}

export function getRerollMenuId(userId, kind, dateKey, primaryId) {
  const menuIds = KIND_CONFIG[kind].menuIds.filter((id) => id !== primaryId)
  if (menuIds.length === 0) {
    return KIND_CONFIG[kind].menuIds[0]
  }

  const seed = ritualSeed(userId, dateKey, `recommend-reroll:${kind}`)
  return menuIds[seed % menuIds.length]
}

export function getActiveMenuId(state, userId, kind, today = getTodayKey()) {
  const config = KIND_CONFIG[kind]
  const normalized = normalizeMenuRecommendations(state)
  const primaryId = getPrimaryMenuId(userId, kind, today)

  if (normalized[config.rerollDayKey] === today) {
    return getRerollMenuId(userId, kind, today, primaryId)
  }

  return primaryId
}

export function applyRecommendReroll(state, userId, kind, today = getTodayKey()) {
  const config = KIND_CONFIG[kind]
  const normalized = { ...state, ...normalizeMenuRecommendations(state) }

  if (normalized[config.rerollDayKey] === today) {
    return { ok: false, reason: 'reroll-used', state: normalized }
  }

  const primaryId = getPrimaryMenuId(userId, kind, today)
  const rerollId = getRerollMenuId(userId, kind, today, primaryId)

  return {
    ok: true,
    menuId: rerollId,
    previousId: primaryId,
    state: {
      ...normalized,
      [config.rerollDayKey]: today,
    },
  }
}

export function buildRecommendTodayView(state, userId, kind, today = getTodayKey()) {
  const config = KIND_CONFIG[kind]
  const normalized = normalizeMenuRecommendations(state)
  const primaryId = getPrimaryMenuId(userId, kind, today)
  const rerollUsed = normalized[config.rerollDayKey] === today

  return {
    kind,
    dayKey: today,
    primaryId,
    activeId: rerollUsed ? getRerollMenuId(userId, kind, today, primaryId) : primaryId,
    canReroll: !rerollUsed,
    rerollUsed,
  }
}
