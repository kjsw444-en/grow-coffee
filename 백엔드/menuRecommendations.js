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
    dayKey: 'recommendCoffeeDayKey',
    primaryId: 'recommendCoffeePrimaryId',
    rerollId: 'recommendCoffeeRerollId',
    rerollDayKey: 'recommendCoffeeRerollDayKey',
    menuIds: COFFEE_MENU_IDS,
  },
  dinner: {
    dayKey: 'recommendDinnerDayKey',
    primaryId: 'recommendDinnerPrimaryId',
    rerollId: 'recommendDinnerRerollId',
    rerollDayKey: 'recommendDinnerRerollDayKey',
    menuIds: DINNER_MENU_IDS,
  },
}

export function normalizeRecommendKind(raw) {
  const kind = String(raw ?? '').trim().toLowerCase()
  return kind === 'coffee' || kind === 'dinner' ? kind : null
}

export function normalizeMenuRecommendations(raw) {
  return {
    recommendCoffeeDayKey: String(
      raw?.recommendCoffeeDayKey ?? raw?.recommend_coffee_day_key ?? '',
    ),
    recommendCoffeePrimaryId: String(
      raw?.recommendCoffeePrimaryId ?? raw?.recommend_coffee_primary_id ?? '',
    ),
    recommendCoffeeRerollId: String(
      raw?.recommendCoffeeRerollId ?? raw?.recommend_coffee_reroll_id ?? '',
    ),
    recommendCoffeeRerollDayKey: String(
      raw?.recommendCoffeeRerollDayKey ?? raw?.recommend_coffee_reroll_day_key ?? '',
    ),
    recommendDinnerDayKey: String(
      raw?.recommendDinnerDayKey ?? raw?.recommend_dinner_day_key ?? '',
    ),
    recommendDinnerPrimaryId: String(
      raw?.recommendDinnerPrimaryId ?? raw?.recommend_dinner_primary_id ?? '',
    ),
    recommendDinnerRerollId: String(
      raw?.recommendDinnerRerollId ?? raw?.recommend_dinner_reroll_id ?? '',
    ),
    recommendDinnerRerollDayKey: String(
      raw?.recommendDinnerRerollDayKey ?? raw?.recommend_dinner_reroll_day_key ?? '',
    ),
  }
}

function pickPrimaryMenuId(userId, kind, dateKey) {
  const menuIds = KIND_CONFIG[kind].menuIds
  const seed = ritualSeed(userId, dateKey, `recommend:${kind}`)
  return menuIds[seed % menuIds.length]
}

function pickRerollMenuId(userId, kind, dateKey, excludeId) {
  const menuIds = KIND_CONFIG[kind].menuIds.filter((id) => id !== excludeId)
  if (menuIds.length === 0) {
    return KIND_CONFIG[kind].menuIds[0]
  }

  const seed = ritualSeed(userId, dateKey, `recommend-reroll:${kind}`)
  return menuIds[seed % menuIds.length]
}

function isValidMenuId(kind, menuId) {
  return KIND_CONFIG[kind].menuIds.includes(menuId)
}

export function getActiveMenuId(state, kind, today = getTodayKey()) {
  const config = KIND_CONFIG[kind]
  const normalized = normalizeMenuRecommendations(state)

  if (normalized[config.dayKey] !== today) {
    return ''
  }

  if (
    normalized[config.rerollDayKey] === today &&
    normalized[config.rerollId] &&
    isValidMenuId(kind, normalized[config.rerollId])
  ) {
    return normalized[config.rerollId]
  }

  if (normalized[config.primaryId] && isValidMenuId(kind, normalized[config.primaryId])) {
    return normalized[config.primaryId]
  }

  return ''
}

export function resolveMenuRecommendations(userId, state, today = getTodayKey()) {
  let next = { ...state, ...normalizeMenuRecommendations(state) }
  let changed = false

  for (const kind of ['coffee', 'dinner']) {
    const config = KIND_CONFIG[kind]
    const currentDayKey = next[config.dayKey]
    const currentPrimaryId = next[config.primaryId]

    if (currentDayKey === today && currentPrimaryId && isValidMenuId(kind, currentPrimaryId)) {
      continue
    }

    next = {
      ...next,
      [config.dayKey]: today,
      [config.primaryId]: pickPrimaryMenuId(userId, kind, today),
      [config.rerollId]: '',
      [config.rerollDayKey]: '',
    }
    changed = true
  }

  return { state: next, changed }
}

export function applyRecommendReroll(state, userId, kind, today = getTodayKey()) {
  const config = KIND_CONFIG[kind]
  const normalized = { ...state, ...normalizeMenuRecommendations(state) }

  if (normalized[config.dayKey] !== today) {
    return { ok: false, reason: 'day-mismatch', state: normalized }
  }

  if (normalized[config.rerollDayKey] === today) {
    return { ok: false, reason: 'reroll-used', state: normalized }
  }

  const activeId = getActiveMenuId(normalized, kind, today)
  if (!activeId) {
    return { ok: false, reason: 'menu-missing', state: normalized }
  }

  const rerollId = pickRerollMenuId(userId, kind, today, activeId)

  return {
    ok: true,
    menuId: rerollId,
    previousId: activeId,
    state: {
      ...normalized,
      [config.rerollId]: rerollId,
      [config.rerollDayKey]: today,
    },
  }
}

export function buildRecommendTodayView(state, kind, today = getTodayKey()) {
  const config = KIND_CONFIG[kind]
  const normalized = normalizeMenuRecommendations(state)
  const dayKey = normalized[config.dayKey]
  const isToday = dayKey === today
  const activeId = isToday ? getActiveMenuId({ ...state, ...normalized }, kind, today) : ''

  return {
    kind,
    dayKey,
    primaryId: isToday ? normalized[config.primaryId] : '',
    activeId,
    canReroll: isToday && normalized[config.rerollDayKey] !== today,
    rerollUsed: isToday && normalized[config.rerollDayKey] === today,
  }
}
