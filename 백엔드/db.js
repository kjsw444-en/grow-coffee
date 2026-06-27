import { randomUUID } from 'node:crypto'
import { initialGameState } from './constants.js'
import { normalizeGameState, sanitizeLoadedGameState } from './gameLogic.js'
import { settlePassiveGrowth } from './passiveGrowth.js'
import { resolveDailyRitual, normalizeDailyRitual } from './dailyRitual.js'
import { getTodayKey } from './waterQuota.js'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from './supabase.js'
import { patchLocalDb, readLocalDb } from './store.js'

const GAME_STATE_COLUMNS_LEGACY_CORE =
  'growth, money, total_coffees, total_waters, redeemed, water_day_key, waters_today, ad_water_credits, growth_accrual_synced_at, passive_day_key, daily_passive_growth, selected_coffee_variant, owned_coffee_variants, spent_coffee_cups'

const GAME_STATE_COLUMNS_CORE = `${GAME_STATE_COLUMNS_LEGACY_CORE}, lifetime_drunk_coffees, lifetime_brewed_spent`

const DAILY_RANKING_COLUMNS =
  'daily_brewed_spent_day_key, daily_brewed_spent, daily_brewed_received_day_key, daily_brewed_received'

const GAME_STATE_COLUMNS_WITH_DAILY_RANKING = `${GAME_STATE_COLUMNS_CORE}, ${DAILY_RANKING_COLUMNS}`

const GAME_STATE_COLUMNS_WITH_PASSIVE_CLAIM = `${GAME_STATE_COLUMNS_WITH_DAILY_RANKING}, passive_coffees_claimed`
const GAME_STATE_COLUMNS_WITH_SHARE = `${GAME_STATE_COLUMNS_WITH_PASSIVE_CLAIM}, share_reward_day_key`
const GAME_STATE_COLUMNS_FULL = `${GAME_STATE_COLUMNS_WITH_SHARE}, passive_reactivate_day_key`

const GAME_STATE_COLUMNS_WITH_ATTENDANCE = `${GAME_STATE_COLUMNS_FULL}, attendance_day_key, attendance_cups_today, attendance_streak, attendance_last_goal_day_key, attendance_daily_claim_day_key, attendance_streak_bonus_pending`

const GAME_STATE_COLUMNS_WITH_POINT = `${GAME_STATE_COLUMNS_WITH_ATTENDANCE}, point_day_key`

const GAME_STATE_COLUMNS_WITH_DAILY_ROULETTE = `${GAME_STATE_COLUMNS_WITH_POINT}, daily_login_roulette_day_key, daily_login_roulette_reward_cups, daily_login_roulette_respin_day_key`

const RITUAL_STATE_COLUMNS =
  'ritual_day_key, ritual_fortune_id, ritual_fortune_revealed, ritual_fortune_progress, ritual_fortune_claimed, ritual_gift_opened, ritual_gift_id, ritual_mission_1_id, ritual_mission_2_id, ritual_mission_3_id, ritual_mission_1_done, ritual_mission_2_done, ritual_mission_3_done, ritual_mission_claimed, ritual_mission_harvest_count, ritual_mission_minigame_done, ritual_mission_roulette_done, ritual_fertilizer_charges, ritual_bonus_roulette_spins'

const RECOMMEND_STATE_COLUMNS =
  'recommend_coffee_reroll_day_key, recommend_dinner_reroll_day_key'

const GAME_STATE_COLUMNS_WITH_RITUAL = `${GAME_STATE_COLUMNS_WITH_DAILY_ROULETTE}, ${RITUAL_STATE_COLUMNS}`

const GAME_STATE_COLUMNS_WITH_RECOMMEND = `${GAME_STATE_COLUMNS_WITH_RITUAL}, ${RECOMMEND_STATE_COLUMNS}`

const GAME_STATE_COLUMNS_WITH_PASSIVE_CLAIM_NO_DAILY_RANKING = `${GAME_STATE_COLUMNS_CORE}, passive_coffees_claimed`
const GAME_STATE_COLUMNS_WITH_SHARE_NO_DAILY_RANKING = `${GAME_STATE_COLUMNS_WITH_PASSIVE_CLAIM_NO_DAILY_RANKING}, share_reward_day_key`
const GAME_STATE_COLUMNS_FULL_NO_DAILY_RANKING = `${GAME_STATE_COLUMNS_WITH_SHARE_NO_DAILY_RANKING}, passive_reactivate_day_key`
const GAME_STATE_COLUMNS_WITH_ATTENDANCE_NO_DAILY_RANKING = `${GAME_STATE_COLUMNS_FULL_NO_DAILY_RANKING}, attendance_day_key, attendance_cups_today, attendance_streak, attendance_last_goal_day_key, attendance_daily_claim_day_key, attendance_streak_bonus_pending`
const GAME_STATE_COLUMNS_WITH_POINT_NO_DAILY_RANKING = `${GAME_STATE_COLUMNS_WITH_ATTENDANCE_NO_DAILY_RANKING}, point_day_key`
const GAME_STATE_COLUMNS_WITH_DAILY_ROULETTE_NO_DAILY_RANKING = `${GAME_STATE_COLUMNS_WITH_POINT_NO_DAILY_RANKING}, daily_login_roulette_day_key, daily_login_roulette_reward_cups, daily_login_roulette_respin_day_key`

const GAME_STATE_COLUMNS_WITH_RITUAL_NO_DAILY_RANKING = `${GAME_STATE_COLUMNS_WITH_DAILY_ROULETTE_NO_DAILY_RANKING}, ${RITUAL_STATE_COLUMNS}`

const GAME_STATE_COLUMNS_WITH_RECOMMEND_NO_DAILY_RANKING = `${GAME_STATE_COLUMNS_WITH_RITUAL_NO_DAILY_RANKING}, ${RECOMMEND_STATE_COLUMNS}`

const GAME_STATE_COLUMNS_WITH_PASSIVE_CLAIM_LEGACY = `${GAME_STATE_COLUMNS_LEGACY_CORE}, passive_coffees_claimed`
const GAME_STATE_COLUMNS_WITH_SHARE_LEGACY = `${GAME_STATE_COLUMNS_WITH_PASSIVE_CLAIM_LEGACY}, share_reward_day_key`
const GAME_STATE_COLUMNS_FULL_LEGACY = `${GAME_STATE_COLUMNS_WITH_SHARE_LEGACY}, passive_reactivate_day_key`

function isMissingLifetimeBrewedSpentColumnError(error) {
  const message = String(error?.message ?? '')
  return message.includes('lifetime_brewed_spent')
}

function warnMissingLifetimeBrewedColumnOnce() {
  console.warn(
    'game_states.lifetime_brewed_spent 컬럼 없음 — 백엔드/schema.sql 마이그레이션 SQL을 Supabase에서 실행해 주세요.',
  )
}

function stripLifetimeBrewedSpent(row) {
  if (!('lifetime_brewed_spent' in row)) return row
  const { lifetime_brewed_spent: _ignored, ...rest } = row
  return rest
}

function isMissingLifetimeDrunkCoffeesColumnError(error) {
  const message = String(error?.message ?? '')
  return message.includes('lifetime_drunk_coffees')
}

function isMissingDailyBrewedSpentColumnError(error) {
  const message = String(error?.message ?? '')
  return (
    message.includes('daily_brewed_spent_day_key') ||
    message.includes('daily_brewed_spent') ||
    message.includes('daily_brewed_received_day_key') ||
    message.includes('daily_brewed_received')
  )
}

function warnMissingDailyBrewedSpentColumnOnce() {
  console.warn(
    'game_states 일일 랭킹 컬럼 없음 — 백엔드/schema.sql 마이그레이션 SQL을 Supabase에서 실행해 주세요.',
  )
}

function warnMissingLifetimeDrunkColumnOnce() {
  console.warn(
    'game_states.lifetime_drunk_coffees 컬럼 없음 — 백엔드/schema.sql 마이그레이션 SQL을 Supabase에서 실행해 주세요.',
  )
}

function isMissingPassiveCoffeesClaimedColumnError(error) {
  const message = String(error?.message ?? '')
  return message.includes('passive_coffees_claimed')
}

function isMissingShareRewardColumnError(error) {
  const message = String(error?.message ?? '')
  return message.includes('share_reward_day_key')
}

function isMissingPassiveReactivateColumnError(error) {
  const message = String(error?.message ?? '')
  return message.includes('passive_reactivate_day_key')
}

function isMissingAttendanceColumnError(error) {
  const message = String(error?.message ?? '')
  return (
    message.includes('attendance_day_key') ||
    message.includes('attendance_cups_today') ||
    message.includes('attendance_streak') ||
    message.includes('attendance_last_goal_day_key') ||
    message.includes('attendance_daily_claim_day_key') ||
    message.includes('attendance_streak_bonus_pending')
  )
}

function isMissingPointDayKeyColumnError(error) {
  const message = String(error?.message ?? '')
  return message.includes('point_day_key')
}

function isMissingDailyLoginRouletteColumnError(error) {
  const message = String(error?.message ?? '')
  return (
    message.includes('daily_login_roulette_day_key') ||
    message.includes('daily_login_roulette_reward_cups') ||
    message.includes('daily_login_roulette_respin_day_key')
  )
}

function isMissingRitualColumnError(error) {
  const message = String(error?.message ?? '')
  return message.includes('ritual_')
}

function isMissingRecommendColumnError(error) {
  const message = String(error?.message ?? '')
  return message.includes('recommend_coffee_') || message.includes('recommend_dinner_')
}

function warnMissingPassiveColumnOnce() {
  console.warn(
    'game_states.passive_coffees_claimed 컬럼 없음 — 백엔드/schema.sql 마이그레이션 SQL을 Supabase에서 실행해 주세요.',
  )
}

function warnMissingShareColumnOnce() {
  console.warn(
    'game_states.share_reward_day_key 컬럼 없음 — 백엔드/schema.sql 마이그레이션 SQL을 Supabase에서 실행해 주세요.',
  )
}

function warnMissingReactivateColumnOnce() {
  console.warn(
    'game_states.passive_reactivate_day_key 컬럼 없음 — 백엔드/schema.sql 마이그레이션 SQL을 Supabase에서 실행해 주세요.',
  )
}

function warnMissingAttendanceColumnOnce() {
  console.warn(
    'game_states 출석 컬럼 없음 — 백엔드/schema.sql 마이그레이션 SQL을 Supabase에서 실행해 주세요.',
  )
}

function warnMissingPointDayKeyColumnOnce() {
  console.warn(
    'game_states.point_day_key 컬럼 없음 — 백엔드/schema.sql 마이그레이션 SQL을 Supabase에서 실행해 주세요.',
  )
}

function warnMissingDailyLoginRouletteColumnOnce() {
  console.warn(
    'game_states 접속 룰렛 컬럼 없음 — 백엔드/schema.sql 마이그레이션 SQL을 Supabase에서 실행해 주세요.',
  )
}

function warnMissingRitualColumnOnce() {
  console.warn(
    'game_states 오늘의 커피 운세(ritual) 컬럼 없음 — 백엔드/schema.sql 마이그레이션 SQL을 Supabase에서 실행해 주세요.',
  )
}

function warnMissingRecommendColumnOnce() {
  console.warn(
    'game_states 오늘의 추천(recommend) 컬럼 없음 — 백엔드/schema.sql 마이그레이션 SQL을 Supabase에서 실행해 주세요.',
  )
}

let warnedPassiveColumn = false
let warnedShareColumn = false
let warnedReactivateColumn = false
let warnedAttendanceColumn = false
let warnedPointDayKeyColumn = false
let warnedDailyLoginRouletteColumn = false
let warnedRitualColumn = false
let warnedRecommendColumn = false
let warnedLifetimeDrunkColumn = false
let warnedLifetimeBrewedColumn = false
let warnedDailyBrewedSpentColumn = false

function stripLifetimeDrunkCoffees(row) {
  if (!('lifetime_drunk_coffees' in row)) return row
  const { lifetime_drunk_coffees: _ignored, ...rest } = row
  return rest
}

function stripDailyBrewedSpentColumns(row) {
  if (!('daily_brewed_spent_day_key' in row) && !('daily_brewed_received_day_key' in row)) return row
  const {
    daily_brewed_spent_day_key: _dayKey,
    daily_brewed_spent: _spent,
    daily_brewed_received_day_key: _receivedDayKey,
    daily_brewed_received: _received,
    ...rest
  } = row
  return rest
}

function stripPassiveCoffeesClaimed(row) {
  if (!('passive_coffees_claimed' in row)) return row
  const { passive_coffees_claimed: _ignored, ...rest } = row
  return rest
}

function stripShareRewardDayKey(row) {
  if (!('share_reward_day_key' in row)) return row
  const { share_reward_day_key: _ignored, ...rest } = row
  return rest
}

function stripPassiveReactivateDayKey(row) {
  if (!('passive_reactivate_day_key' in row)) return row
  const { passive_reactivate_day_key: _ignored, ...rest } = row
  return rest
}

function stripAttendanceColumns(row) {
  if (!('attendance_day_key' in row)) return row
  const {
    attendance_day_key: _dayKey,
    attendance_cups_today: _cupsToday,
    attendance_streak: _streak,
    attendance_last_goal_day_key: _lastGoal,
    attendance_daily_claim_day_key: _dailyClaim,
    attendance_streak_bonus_pending: _streakBonus,
    ...rest
  } = row
  return rest
}

function stripPointDayKey(row) {
  if (!('point_day_key' in row)) return row
  const { point_day_key: _ignored, ...rest } = row
  return rest
}

function stripDailyLoginRouletteRespinDayKey(row) {
  if (!('daily_login_roulette_respin_day_key' in row)) return row
  const { daily_login_roulette_respin_day_key: _ignored, ...rest } = row
  return rest
}

function stripDailyLoginRouletteRewardCups(row) {
  if (!('daily_login_roulette_reward_cups' in row)) return row
  const { daily_login_roulette_reward_cups: _ignored, ...rest } = row
  return rest
}

function stripDailyLoginRouletteDayKey(row) {
  if (!('daily_login_roulette_day_key' in row)) return row
  const { daily_login_roulette_day_key: _ignored, ...rest } = row
  return rest
}

function stripRitualColumns(row) {
  if (!('ritual_day_key' in row)) return row
  const {
    ritual_day_key: _dayKey,
    ritual_fortune_id: _fortuneId,
    ritual_fortune_revealed: _fortuneRevealed,
    ritual_fortune_progress: _fortuneProgress,
    ritual_fortune_claimed: _fortuneClaimed,
    ritual_gift_opened: _giftOpened,
    ritual_gift_id: _giftId,
    ritual_mission_1_id: _m1Id,
    ritual_mission_2_id: _m2Id,
    ritual_mission_3_id: _m3Id,
    ritual_mission_1_done: _m1Done,
    ritual_mission_2_done: _m2Done,
    ritual_mission_3_done: _m3Done,
    ritual_mission_claimed: _missionClaimed,
    ritual_mission_harvest_count: _harvestCount,
    ritual_mission_minigame_done: _minigameDone,
    ritual_mission_roulette_done: _rouletteDone,
    ritual_fertilizer_charges: _fertilizer,
    ritual_bonus_roulette_spins: _bonusSpins,
    ...rest
  } = row
  return rest
}

function stripRecommendColumns(row) {
  if (!('recommend_coffee_reroll_day_key' in row)) return row
  const {
    recommend_coffee_reroll_day_key: _coffeeRerollDayKey,
    recommend_dinner_reroll_day_key: _dinnerRerollDayKey,
    ...rest
  } = row
  return rest
}

function mapProfileRow(row) {
  return {
    userId: row.id,
    displayName: row.display_name,
    source: row.source,
  }
}

function isDuplicateDeviceIdError(error) {
  const code = String(error?.code ?? '')
  const message = String(error?.message ?? '')
  return code === '23505' && message.includes('profiles_device_id_key')
}

async function fetchProfileByDeviceId(supabase, deviceId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, source')
    .eq('device_id', deviceId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

async function discardOrphanAuthUser(supabase, userId) {
  try {
    await supabase.auth.admin.deleteUser(userId)
  } catch {
    // race loser cleanup — best effort
  }
}

function mapGameRow(row) {
  return sanitizeLoadedGameState({
    growth: row.growth,
    money: row.money,
    totalCoffees: row.total_coffees,
    totalWaters: row.total_waters,
    redeemed: row.redeemed,
    waterDayKey: row.water_day_key,
    watersToday: row.waters_today,
    adWaterCredits: row.ad_water_credits,
    growthAccrualSyncedAt: row.growth_accrual_synced_at,
    passiveDayKey: row.passive_day_key,
    dailyPassiveGrowth: row.daily_passive_growth,
    passiveCoffeesClaimed: Number(row.passive_coffees_claimed ?? 0),
    passiveReactivateDayKey: String(row.passive_reactivate_day_key ?? ''),
    selectedCoffeeVariant: row.selected_coffee_variant,
    ownedCoffeeVariants: row.owned_coffee_variants,
    spentCoffeeCups: row.spent_coffee_cups,
    lifetimeDrunkCoffees: Number(row.lifetime_drunk_coffees ?? 0),
    lifetimeBrewedSpent: Number(row.lifetime_brewed_spent ?? row.lifetime_drunk_coffees ?? 0),
    dailyBrewedSpentDayKey: String(row.daily_brewed_spent_day_key ?? ''),
    dailyBrewedSpent: Number(row.daily_brewed_spent ?? 0),
    dailyBrewedReceivedDayKey: String(row.daily_brewed_received_day_key ?? ''),
    dailyBrewedReceived: Number(row.daily_brewed_received ?? 0),
    shareRewardDayKey: row.share_reward_day_key,
    attendanceDayKey: String(row.attendance_day_key ?? ''),
    attendanceCupsToday: Number(row.attendance_cups_today ?? 0),
    attendanceStreak: Number(row.attendance_streak ?? 0),
    attendanceLastGoalDayKey: String(row.attendance_last_goal_day_key ?? ''),
    attendanceDailyClaimDayKey: String(row.attendance_daily_claim_day_key ?? ''),
    attendanceStreakBonusPending: Boolean(row.attendance_streak_bonus_pending),
    pointDayKey: String(row.point_day_key ?? ''),
    dailyLoginRouletteDayKey: String(row.daily_login_roulette_day_key ?? ''),
    dailyLoginRouletteRewardCups: Number(row.daily_login_roulette_reward_cups ?? 0),
    dailyLoginRouletteRespinDayKey: String(row.daily_login_roulette_respin_day_key ?? ''),
    ritualDayKey: String(row.ritual_day_key ?? ''),
    ritualFortuneId: String(row.ritual_fortune_id ?? ''),
    ritualFortuneRevealed: Boolean(row.ritual_fortune_revealed),
    ritualFortuneProgress: Number(row.ritual_fortune_progress ?? 0),
    ritualFortuneClaimed: Boolean(row.ritual_fortune_claimed),
    ritualGiftOpened: Boolean(row.ritual_gift_opened),
    ritualGiftId: String(row.ritual_gift_id ?? ''),
    ritualMission1Id: String(row.ritual_mission_1_id ?? ''),
    ritualMission2Id: String(row.ritual_mission_2_id ?? ''),
    ritualMission3Id: String(row.ritual_mission_3_id ?? ''),
    ritualMission1Done: Boolean(row.ritual_mission_1_done),
    ritualMission2Done: Boolean(row.ritual_mission_2_done),
    ritualMission3Done: Boolean(row.ritual_mission_3_done),
    ritualMissionClaimed: Boolean(row.ritual_mission_claimed),
    ritualMissionHarvestCount: Number(row.ritual_mission_harvest_count ?? 0),
    ritualMissionMinigameDone: Boolean(row.ritual_mission_minigame_done),
    ritualMissionRouletteDone: Boolean(row.ritual_mission_roulette_done),
    ritualFertilizerCharges: Number(row.ritual_fertilizer_charges ?? 0),
    ritualBonusRouletteSpins: Number(row.ritual_bonus_roulette_spins ?? 0),
    recommendCoffeeRerollDayKey: String(row.recommend_coffee_reroll_day_key ?? ''),
    recommendDinnerRerollDayKey: String(row.recommend_dinner_reroll_day_key ?? ''),
  })
}

function findLocalProfileByDeviceId(deviceId) {
  const db = readLocalDb()

  for (const [userId, profile] of Object.entries(db.profiles)) {
    if (profile.deviceId === deviceId) {
      return { userId, ...profile }
    }
  }

  return null
}

function findLocalProfileByTossKey(tossUserKey) {
  const db = readLocalDb()

  for (const [userId, profile] of Object.entries(db.profiles)) {
    if (profile.tossUserKey === tossUserKey) {
      return { userId, ...profile }
    }
  }

  return null
}

function pickBetterGameState(left, right) {
  const a = normalizeGameState(left)
  const b = normalizeGameState(right)

  if (a.money !== b.money) {
    return a.money > b.money ? a : b
  }

  if (a.totalCoffees !== b.totalCoffees) {
    return a.totalCoffees > b.totalCoffees ? a : b
  }

  if (a.lifetimeBrewedSpent !== b.lifetimeBrewedSpent) {
    return a.lifetimeBrewedSpent > b.lifetimeBrewedSpent ? a : b
  }

  if (a.lifetimeDrunkCoffees !== b.lifetimeDrunkCoffees) {
    return a.lifetimeDrunkCoffees > b.lifetimeDrunkCoffees ? a : b
  }

  if (a.spentCoffeeCups !== b.spentCoffeeCups) {
    return a.spentCoffeeCups > b.spentCoffeeCups ? a : b
  }

  return a.totalWaters >= b.totalWaters ? a : b
}

async function mergeGuestGameStateIntoToss(guestUserId, tossUserId) {
  if (!guestUserId || guestUserId === tossUserId) {
    return
  }

  if (!isSupabaseAdminConfigured()) {
    patchLocalDb((db) => {
      const guestState = db.gameStates[guestUserId]
      const tossState = db.gameStates[tossUserId]

      if (guestState) {
        db.gameStates[tossUserId] = pickBetterGameState(guestState, tossState ?? initialGameState)
      }

      delete db.profiles[guestUserId]
      delete db.gameStates[guestUserId]
      delete db.lastActionAt[guestUserId]
      delete db.rankings?.[guestUserId]
    })
    return
  }

  const supabase = getSupabaseAdmin()

  const { data: guestState, error: guestError } = await supabase
    .from('game_states')
    .select('*')
    .eq('user_id', guestUserId)
    .maybeSingle()

  if (guestError) {
    throw guestError
  }

  const { data: tossState, error: tossError } = await supabase
    .from('game_states')
    .select('*')
    .eq('user_id', tossUserId)
    .maybeSingle()

  if (tossError) {
    throw tossError
  }

  if (guestState) {
    const guestMapped = mapGameRow(guestState)
    const tossMapped = tossState ? mapGameRow(tossState) : initialGameState
    const merged = pickBetterGameState(guestMapped, tossMapped)

    const { error: upsertError } = await upsertGameRow(
      supabase,
      {
        user_id: tossUserId,
        ...toGameRow(merged),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

    if (upsertError) {
      throw upsertError
    }
  }

  await supabase.auth.admin.deleteUser(guestUserId)
}

export async function getProfileDisplayName(userId) {
  if (!userId) {
    return '커피 농부'
  }

  if (!isSupabaseAdminConfigured()) {
    const db = readLocalDb()
    return db.profiles[userId]?.displayName || '커피 농부'
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data?.display_name || '커피 농부'
}

export async function resolveGuestSession(deviceId, displayName) {
  const safeDeviceId = String(deviceId || '').trim()
  const nextDisplayName = String(displayName || '커피 농부').trim().slice(0, 24)

  if (!safeDeviceId) {
    throw new Error('deviceId가 필요합니다.')
  }

  if (!isSupabaseAdminConfigured()) {
    const existing = findLocalProfileByDeviceId(safeDeviceId)

    if (existing) {
      return {
        userId: existing.userId,
        displayName: existing.displayName,
        source: 'guest',
      }
    }

    const userId = randomUUID()

    patchLocalDb((db) => {
      db.profiles[userId] = {
        deviceId: safeDeviceId,
        displayName: nextDisplayName,
        source: 'guest',
      }
      db.gameStates[userId] = { ...initialGameState }
    })

    return { userId, displayName: nextDisplayName, source: 'guest' }
  }

  const supabase = getSupabaseAdmin()
  const { data: existing, error: lookupError } = await supabase
    .from('profiles')
    .select('id, display_name, source')
    .eq('device_id', safeDeviceId)
    .maybeSingle()

  if (lookupError) {
    throw lookupError
  }

  if (existing) {
    return mapProfileRow(existing)
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: `guest+${randomUUID()}@grow-coffee.local`,
    email_confirm: true,
    user_metadata: { device_id: safeDeviceId },
  })

  if (authError) {
    throw authError
  }

  const userId = authData.user.id

  const { error: profileError } = await supabase.from('profiles').insert({
    id: userId,
    device_id: safeDeviceId,
    display_name: nextDisplayName,
    source: 'guest',
  })

  if (profileError) {
    if (isDuplicateDeviceIdError(profileError)) {
      const raced = await fetchProfileByDeviceId(supabase, safeDeviceId)
      if (raced) {
        await discardOrphanAuthUser(supabase, userId)
        return mapProfileRow(raced)
      }
    }
    throw profileError
  }

  const { error: gameError } = await insertGameRow(supabase, {
    user_id: userId,
    ...toGameRow(initialGameState),
  })

  if (gameError) {
    throw gameError
  }

  return { userId, displayName: nextDisplayName, source: 'guest' }
}

export async function resolveTossSession({
  tossUserKey,
  displayName,
  deviceId,
  refreshToken,
}) {
  const key = String(tossUserKey || '').trim()
  const nextDisplayName = String(displayName || '커피 농부').trim().slice(0, 24)
  const safeDeviceId = String(deviceId || '').trim()
  const nextRefreshToken = String(refreshToken || '').trim() || null

  if (!key) {
    throw new Error('tossUserKey가 필요합니다.')
  }

  if (!isSupabaseAdminConfigured()) {
    const existingToss = findLocalProfileByTossKey(key)

    if (existingToss) {
      patchLocalDb((db) => {
        db.profiles[existingToss.userId] = {
          ...db.profiles[existingToss.userId],
          displayName: nextDisplayName,
          source: 'toss',
          tossUserKey: key,
          ...(nextRefreshToken ? { tossRefreshToken: nextRefreshToken } : {}),
        }
      })

      if (safeDeviceId) {
        const guest = findLocalProfileByDeviceId(safeDeviceId)
        if (guest && guest.userId !== existingToss.userId) {
          await mergeGuestGameStateIntoToss(guest.userId, existingToss.userId)
        }
      }

      return {
        userId: existingToss.userId,
        displayName: nextDisplayName,
        source: 'toss',
      }
    }

    if (safeDeviceId) {
      const guest = findLocalProfileByDeviceId(safeDeviceId)

      if (guest) {
        patchLocalDb((db) => {
          db.profiles[guest.userId] = {
            ...db.profiles[guest.userId],
            tossUserKey: key,
            source: 'toss',
            displayName: nextDisplayName,
            ...(nextRefreshToken ? { tossRefreshToken: nextRefreshToken } : {}),
          }
          delete db.profiles[guest.userId].deviceId
        })

        return {
          userId: guest.userId,
          displayName: nextDisplayName,
          source: 'toss',
        }
      }
    }

    const userId = `toss_${key}`

    patchLocalDb((db) => {
      db.profiles[userId] = {
        tossUserKey: key,
        displayName: nextDisplayName,
        source: 'toss',
        ...(nextRefreshToken ? { tossRefreshToken: nextRefreshToken } : {}),
      }
      if (!db.gameStates[userId]) {
        db.gameStates[userId] = { ...initialGameState }
      }
    })

    return { userId, displayName: nextDisplayName, source: 'toss' }
  }

  const supabase = getSupabaseAdmin()
  const { data: tossProfile, error: tossLookupError } = await supabase
    .from('profiles')
    .select('id, display_name, source')
    .eq('toss_user_key', key)
    .maybeSingle()

  if (tossLookupError) {
    throw tossLookupError
  }

  if (tossProfile) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        display_name: nextDisplayName,
        source: 'toss',
        ...(nextRefreshToken ? { toss_refresh_token: nextRefreshToken } : {}),
      })
      .eq('id', tossProfile.id)

    if (updateError) {
      throw updateError
    }

    if (safeDeviceId) {
      const { data: guestProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('device_id', safeDeviceId)
        .maybeSingle()

      if (guestProfile && guestProfile.id !== tossProfile.id) {
        await mergeGuestGameStateIntoToss(guestProfile.id, tossProfile.id)
      }
    }

    return {
      userId: tossProfile.id,
      displayName: nextDisplayName,
      source: 'toss',
    }
  }

  if (safeDeviceId) {
    const { data: guestProfile, error: guestLookupError } = await supabase
      .from('profiles')
      .select('id, display_name, source')
      .eq('device_id', safeDeviceId)
      .maybeSingle()

    if (guestLookupError) {
      throw guestLookupError
    }

    if (guestProfile) {
      const { error: upgradeError } = await supabase
        .from('profiles')
        .update({
          toss_user_key: key,
          source: 'toss',
          device_id: null,
          display_name: nextDisplayName,
          ...(nextRefreshToken ? { toss_refresh_token: nextRefreshToken } : {}),
        })
        .eq('id', guestProfile.id)

      if (upgradeError) {
        throw upgradeError
      }

      return {
        userId: guestProfile.id,
        displayName: nextDisplayName,
        source: 'toss',
      }
    }
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: `toss+${key}@grow-coffee.local`,
    email_confirm: true,
    user_metadata: { toss_user_key: key },
  })

  if (authError) {
    throw authError
  }

  const userId = authData.user.id

  const { error: profileError } = await supabase.from('profiles').insert({
    id: userId,
    toss_user_key: key,
    display_name: nextDisplayName,
    source: 'toss',
    ...(nextRefreshToken ? { toss_refresh_token: nextRefreshToken } : {}),
  })

  if (profileError) {
    throw profileError
  }

  const { error: gameError } = await insertGameRow(supabase, {
    user_id: userId,
    ...toGameRow(initialGameState),
  })

  if (gameError) {
    throw gameError
  }

  return { userId, displayName: nextDisplayName, source: 'toss' }
}

export async function handleTossUnlink(userKey) {
  const key = String(userKey || '').trim()

  if (!key) {
    throw new Error('userKey가 필요합니다.')
  }

  if (!isSupabaseAdminConfigured()) {
    const profile = findLocalProfileByTossKey(key)

    if (profile) {
      patchLocalDb((db) => {
        delete db.profiles[profile.userId]
        delete db.gameStates[profile.userId]
        delete db.lastActionAt[profile.userId]
        delete db.rankings[profile.userId]
      })
    }

    return { removed: Boolean(profile) }
  }

  const supabase = getSupabaseAdmin()
  const { data: profile, error: lookupError } = await supabase
    .from('profiles')
    .select('id')
    .eq('toss_user_key', key)
    .maybeSingle()

  if (lookupError) {
    throw lookupError
  }

  if (!profile) {
    return { removed: false }
  }

  const { error: deleteError } = await supabase.auth.admin.deleteUser(profile.id)

  if (deleteError) {
    throw deleteError
  }

  return { removed: true }
}

function toGameRow(state) {
  const current = normalizeGameState(state)

  const row = {
    growth: current.growth,
    money: current.money,
    total_coffees: current.totalCoffees,
    total_waters: current.totalWaters,
    redeemed: current.redeemed,
    water_day_key: current.waterDayKey,
    waters_today: current.watersToday,
    ad_water_credits: current.adWaterCredits,
    growth_accrual_synced_at: current.growthAccrualSyncedAt,
    passive_day_key: current.passiveDayKey,
    daily_passive_growth: current.dailyPassiveGrowth,
    passive_coffees_claimed: current.passiveCoffeesClaimed,
    passive_reactivate_day_key: current.passiveReactivateDayKey,
    selected_coffee_variant: current.selectedCoffeeVariant,
    owned_coffee_variants: current.ownedCoffeeVariants,
    spent_coffee_cups: current.spentCoffeeCups,
    lifetime_drunk_coffees: current.lifetimeDrunkCoffees,
    lifetime_brewed_spent: current.lifetimeBrewedSpent,
    daily_brewed_spent_day_key: current.dailyBrewedSpentDayKey,
    daily_brewed_spent: current.dailyBrewedSpent,
    daily_brewed_received_day_key: current.dailyBrewedReceivedDayKey,
    daily_brewed_received: current.dailyBrewedReceived,
    share_reward_day_key: current.shareRewardDayKey,
    attendance_day_key: current.attendanceDayKey,
    attendance_cups_today: current.attendanceCupsToday,
    attendance_streak: current.attendanceStreak,
    attendance_last_goal_day_key: current.attendanceLastGoalDayKey,
    attendance_daily_claim_day_key: current.attendanceDailyClaimDayKey,
    attendance_streak_bonus_pending: current.attendanceStreakBonusPending,
    point_day_key: current.pointDayKey,
    daily_login_roulette_day_key: current.dailyLoginRouletteDayKey,
    daily_login_roulette_reward_cups: current.dailyLoginRouletteRewardCups,
    daily_login_roulette_respin_day_key: current.dailyLoginRouletteRespinDayKey,
    ritual_day_key: current.ritualDayKey,
    ritual_fortune_id: current.ritualFortuneId,
    ritual_fortune_revealed: current.ritualFortuneRevealed,
    ritual_fortune_progress: current.ritualFortuneProgress,
    ritual_fortune_claimed: current.ritualFortuneClaimed,
    ritual_gift_opened: current.ritualGiftOpened,
    ritual_gift_id: current.ritualGiftId,
    ritual_mission_1_id: current.ritualMission1Id,
    ritual_mission_2_id: current.ritualMission2Id,
    ritual_mission_3_id: current.ritualMission3Id,
    ritual_mission_1_done: current.ritualMission1Done,
    ritual_mission_2_done: current.ritualMission2Done,
    ritual_mission_3_done: current.ritualMission3Done,
    ritual_mission_claimed: current.ritualMissionClaimed,
    ritual_mission_harvest_count: current.ritualMissionHarvestCount,
    ritual_mission_minigame_done: current.ritualMissionMinigameDone,
    ritual_mission_roulette_done: current.ritualMissionRouletteDone,
    ritual_fertilizer_charges: current.ritualFertilizerCharges,
    ritual_bonus_roulette_spins: current.ritualBonusRouletteSpins,
    recommend_coffee_reroll_day_key: current.recommendCoffeeRerollDayKey,
    recommend_dinner_reroll_day_key: current.recommendDinnerRerollDayKey,
  }

  return row
}

const GAME_STATE_SELECT_VARIANTS = [
  GAME_STATE_COLUMNS_WITH_RECOMMEND,
  GAME_STATE_COLUMNS_WITH_RECOMMEND_NO_DAILY_RANKING,
  GAME_STATE_COLUMNS_WITH_RITUAL,
  GAME_STATE_COLUMNS_WITH_RITUAL_NO_DAILY_RANKING,
  GAME_STATE_COLUMNS_WITH_DAILY_ROULETTE,
  GAME_STATE_COLUMNS_WITH_DAILY_ROULETTE_NO_DAILY_RANKING,
  GAME_STATE_COLUMNS_WITH_POINT,
  GAME_STATE_COLUMNS_WITH_POINT_NO_DAILY_RANKING,
  GAME_STATE_COLUMNS_WITH_ATTENDANCE,
  GAME_STATE_COLUMNS_WITH_ATTENDANCE_NO_DAILY_RANKING,
  GAME_STATE_COLUMNS_FULL,
  GAME_STATE_COLUMNS_FULL_NO_DAILY_RANKING,
  GAME_STATE_COLUMNS_FULL_LEGACY,
  GAME_STATE_COLUMNS_WITH_SHARE,
  GAME_STATE_COLUMNS_WITH_SHARE_NO_DAILY_RANKING,
  GAME_STATE_COLUMNS_WITH_PASSIVE_CLAIM,
  GAME_STATE_COLUMNS_WITH_PASSIVE_CLAIM_NO_DAILY_RANKING,
  GAME_STATE_COLUMNS_CORE,
  GAME_STATE_COLUMNS_LEGACY_CORE,
]

function isMissingGameStateColumnError(error) {
  return (
    isMissingRecommendColumnError(error) ||
    isMissingRitualColumnError(error) ||
    isMissingDailyLoginRouletteColumnError(error) ||
    isMissingPointDayKeyColumnError(error) ||
    isMissingAttendanceColumnError(error) ||
    isMissingDailyBrewedSpentColumnError(error) ||
    isMissingLifetimeDrunkCoffeesColumnError(error) ||
    isMissingLifetimeBrewedSpentColumnError(error) ||
    isMissingPassiveReactivateColumnError(error) ||
    isMissingShareRewardColumnError(error) ||
    isMissingPassiveCoffeesClaimedColumnError(error)
  )
}

function warnMissingGameStateColumnOnce(error) {
  if (isMissingRitualColumnError(error) && !warnedRitualColumn) {
    warnedRitualColumn = true
    warnMissingRitualColumnOnce()
    return
  }

  if (isMissingRecommendColumnError(error) && !warnedRecommendColumn) {
    warnedRecommendColumn = true
    warnMissingRecommendColumnOnce()
    return
  }

  if (isMissingDailyLoginRouletteColumnError(error) && !warnedDailyLoginRouletteColumn) {
    warnedDailyLoginRouletteColumn = true
    warnMissingDailyLoginRouletteColumnOnce()
    return
  }

  if (isMissingPointDayKeyColumnError(error) && !warnedPointDayKeyColumn) {
    warnedPointDayKeyColumn = true
    warnMissingPointDayKeyColumnOnce()
    return
  }

  if (isMissingAttendanceColumnError(error) && !warnedAttendanceColumn) {
    warnedAttendanceColumn = true
    warnMissingAttendanceColumnOnce()
    return
  }

  if (isMissingDailyBrewedSpentColumnError(error) && !warnedDailyBrewedSpentColumn) {
    warnedDailyBrewedSpentColumn = true
    warnMissingDailyBrewedSpentColumnOnce()
    return
  }

  if (isMissingLifetimeDrunkCoffeesColumnError(error) && !warnedLifetimeDrunkColumn) {
    warnedLifetimeDrunkColumn = true
    warnMissingLifetimeDrunkColumnOnce()
    return
  }

  if (isMissingLifetimeBrewedSpentColumnError(error) && !warnedLifetimeBrewedColumn) {
    warnedLifetimeBrewedColumn = true
    warnMissingLifetimeBrewedColumnOnce()
    return
  }

  if (isMissingPassiveReactivateColumnError(error) && !warnedReactivateColumn) {
    warnedReactivateColumn = true
    warnMissingReactivateColumnOnce()
    return
  }

  if (isMissingShareRewardColumnError(error) && !warnedShareColumn) {
    warnedShareColumn = true
    warnMissingShareColumnOnce()
    return
  }

  if (isMissingPassiveCoffeesClaimedColumnError(error) && !warnedPassiveColumn) {
    warnedPassiveColumn = true
    warnMissingPassiveColumnOnce()
  }
}

function stripMissingGameStateColumns(error, payload) {
  if (isMissingRecommendColumnError(error)) {
    return stripRecommendColumns(payload)
  }

  if (isMissingRitualColumnError(error)) {
    return stripRitualColumns(payload)
  }

  if (String(error?.message ?? '').includes('daily_login_roulette_respin_day_key')) {
    return stripDailyLoginRouletteRespinDayKey(payload)
  }

  if (String(error?.message ?? '').includes('daily_login_roulette_reward_cups')) {
    return stripDailyLoginRouletteRewardCups(payload)
  }

  if (isMissingDailyLoginRouletteColumnError(error)) {
    return stripDailyLoginRouletteDayKey(payload)
  }

  if (isMissingPointDayKeyColumnError(error)) {
    return stripPointDayKey(payload)
  }

  if (isMissingAttendanceColumnError(error)) {
    return stripAttendanceColumns(payload)
  }

  if (isMissingDailyBrewedSpentColumnError(error)) {
    return stripDailyBrewedSpentColumns(payload)
  }

  if (isMissingLifetimeDrunkCoffeesColumnError(error)) {
    return stripLifetimeDrunkCoffees(payload)
  }

  if (isMissingLifetimeBrewedSpentColumnError(error)) {
    return stripLifetimeBrewedSpent(payload)
  }

  if (isMissingPassiveReactivateColumnError(error)) {
    return stripPassiveReactivateDayKey(payload)
  }

  if (isMissingShareRewardColumnError(error)) {
    return stripShareRewardDayKey(payload)
  }

  if (isMissingPassiveCoffeesClaimedColumnError(error)) {
    return stripPassiveCoffeesClaimed(payload)
  }

  return null
}

async function writeGameRowWithFallback(supabase, row, write) {
  let payload = { ...row }
  let result = await write(payload)
  let guard = 0

  while (result.error && isMissingGameStateColumnError(result.error) && guard < 8) {
    warnMissingGameStateColumnOnce(result.error)
    const nextPayload = stripMissingGameStateColumns(result.error, payload)

    if (!nextPayload) {
      break
    }

    payload = nextPayload
    result = await write(payload)
    guard += 1
  }

  return result
}

async function insertGameRow(supabase, row) {
  return writeGameRowWithFallback(supabase, row, (payload) =>
    supabase.from('game_states').insert(payload),
  )
}

async function upsertGameRow(supabase, row, options) {
  return writeGameRowWithFallback(supabase, row, (payload) =>
    supabase.from('game_states').upsert(payload, options),
  )
}

async function selectGameRow(supabase, userId) {
  let lastResult = null

  for (const columns of GAME_STATE_SELECT_VARIANTS) {
    const result = await supabase
      .from('game_states')
      .select(columns)
      .eq('user_id', userId)
      .maybeSingle()

    lastResult = result

    if (!result.error) {
      return result
    }

    if (!isMissingGameStateColumnError(result.error)) {
      return result
    }

    warnMissingGameStateColumnOnce(result.error)
  }

  return lastResult
}

function passiveGrowthChanged(before, after) {
  return (
    before.growth !== after.growth ||
    before.dailyPassiveGrowth !== after.dailyPassiveGrowth ||
    before.growthAccrualSyncedAt !== after.growthAccrualSyncedAt ||
    before.passiveDayKey !== after.passiveDayKey
  )
}

function ritualProgressScore(ritual) {
  let score = 0
  if (ritual.ritualFortuneId) score += 1
  if (ritual.ritualFortuneRevealed) score += 4
  if (ritual.ritualGiftOpened) score += 16
  if (ritual.ritualMissionClaimed) score += 64
  return score
}

function saveRitualOverlay(userId, state) {
  patchLocalDb((db) => {
    db.ritualOverlays ??= {}
    db.ritualOverlays[userId] = normalizeDailyRitual(state)
  })
}

function clearStaleRitualOverlay(userId, today = getTodayKey()) {
  patchLocalDb((db) => {
    const overlay = db.ritualOverlays?.[userId]
    if (overlay?.ritualDayKey && overlay.ritualDayKey !== today) {
      delete db.ritualOverlays[userId]
    }
  })
}

function mergeRitualOverlay(userId, state) {
  clearStaleRitualOverlay(userId)
  const overlay = readLocalDb().ritualOverlays?.[userId]
  if (!overlay) {
    return state
  }

  const fromDb = normalizeDailyRitual(state)
  const fromOverlay = normalizeDailyRitual(overlay)
  if (ritualProgressScore(fromOverlay) > ritualProgressScore(fromDb)) {
    return { ...state, ...fromOverlay }
  }

  return state
}

async function resolveAndPersistDailyRitual(userId, state) {
  const resolved = resolveDailyRitual(userId, state, getTodayKey())
  const before = normalizeDailyRitual(state)
  const after = normalizeDailyRitual(resolved)

  const needsSave =
    before.ritualDayKey !== after.ritualDayKey ||
    (!before.ritualFortuneId && after.ritualFortuneId)

  if (!needsSave) {
    return { ...state, ...after }
  }

  return saveGameState(userId, resolved)
}

async function settleAndPersistPassiveGrowth(userId, raw) {
  const loaded = sanitizeLoadedGameState(raw ?? initialGameState)
  const settled = settlePassiveGrowth(loaded)

  if (!passiveGrowthChanged(loaded, settled)) {
    return settled
  }

  return saveGameState(userId, settled)
}

export async function getGameState(userId) {
  if (!isSupabaseAdminConfigured()) {
    const db = readLocalDb()
    const afterPassive = await settleAndPersistPassiveGrowth(userId, db.gameStates[userId])
    return resolveAndPersistDailyRitual(userId, mergeRitualOverlay(userId, afterPassive))
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await selectGameRow(supabase, userId)

  if (error) {
    throw error
  }

  if (!data) {
    const { error: insertError } = await insertGameRow(supabase, {
      user_id: userId,
      ...toGameRow(initialGameState),
    })

    if (insertError) {
      throw insertError
    }

    const seeded = resolveDailyRitual(userId, { ...initialGameState }, getTodayKey())
    return resolveAndPersistDailyRitual(userId, settlePassiveGrowth(seeded))
  }

  const afterPassive = await settleAndPersistPassiveGrowth(userId, mapGameRow(data))
  const withRitual = mergeRitualOverlay(userId, afterPassive)
  return resolveAndPersistDailyRitual(userId, withRitual)
}

export async function saveGameState(userId, state, options = {}) {
  let next = normalizeGameState(state)
  const allowTotalCoffeeDecrease = options.allowTotalCoffeeDecrease === true

  if (!isSupabaseAdminConfigured()) {
    patchLocalDb((db) => {
      if (!allowTotalCoffeeDecrease) {
        const current = normalizeGameState(db.gameStates[userId] ?? initialGameState)
        next = {
          ...next,
          totalCoffees: Math.max(next.totalCoffees, current.totalCoffees),
        }
      }
      db.gameStates[userId] = next
      saveRitualOverlay(userId, next)
    })
    return next
  }

  const supabase = getSupabaseAdmin()

  if (!allowTotalCoffeeDecrease) {
    const { data, error } = await selectGameRow(supabase, userId)
    if (error) {
      throw error
    }
    if (data) {
      const current = mapGameRow(data)
      next = {
        ...next,
        totalCoffees: Math.max(next.totalCoffees, current.totalCoffees),
      }
    }
  }

  const { error } = await upsertGameRow(
    supabase,
    {
      user_id: userId,
      ...toGameRow(next),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  if (error) {
    throw error
  }

  saveRitualOverlay(userId, next)

  return next
}

export function getLastActionAt(userId) {
  const db = readLocalDb()
  return Number(db.lastActionAt[userId] ?? 0)
}

export function setLastActionAt(userId, timestamp) {
  patchLocalDb((db) => {
    db.lastActionAt[userId] = timestamp
  })
}
