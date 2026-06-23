import { randomUUID } from 'node:crypto'
import { initialGameState } from './constants.js'
import { normalizeGameState, sanitizeLoadedGameState } from './gameLogic.js'
import { settlePassiveGrowth } from './passiveGrowth.js'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from './supabase.js'
import { patchLocalDb, readLocalDb } from './store.js'

const GAME_STATE_COLUMNS_CORE =
  'growth, money, total_coffees, total_waters, redeemed, water_day_key, waters_today, ad_water_credits, growth_accrual_synced_at, passive_day_key, daily_passive_growth, selected_coffee_variant, owned_coffee_variants, spent_coffee_cups'

const GAME_STATE_COLUMNS_WITH_PASSIVE_CLAIM = `${GAME_STATE_COLUMNS_CORE}, passive_coffees_claimed`
const GAME_STATE_COLUMNS_WITH_SHARE = `${GAME_STATE_COLUMNS_WITH_PASSIVE_CLAIM}, share_reward_day_key`
const GAME_STATE_COLUMNS_FULL = `${GAME_STATE_COLUMNS_WITH_SHARE}, passive_reactivate_day_key`

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

function warnMissingPassiveColumnOnce() {
  console.warn(
    'game_states.passive_coffees_claimed 컬럼 없음 — backend/schema.sql 마이그레이션 SQL을 Supabase에서 실행해 주세요.',
  )
}

function warnMissingShareColumnOnce() {
  console.warn(
    'game_states.share_reward_day_key 컬럼 없음 — backend/schema.sql 마이그레이션 SQL을 Supabase에서 실행해 주세요.',
  )
}

function warnMissingReactivateColumnOnce() {
  console.warn(
    'game_states.passive_reactivate_day_key 컬럼 없음 — backend/schema.sql 마이그레이션 SQL을 Supabase에서 실행해 주세요.',
  )
}

let warnedPassiveColumn = false
let warnedShareColumn = false
let warnedReactivateColumn = false

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

function mapProfileRow(row) {
  return {
    userId: row.id,
    displayName: row.display_name,
    source: row.source,
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
    shareRewardDayKey: row.share_reward_day_key,
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
    share_reward_day_key: current.shareRewardDayKey,
  }

  return row
}

async function insertGameRow(supabase, row) {
  let payload = row
  let result = await supabase.from('game_states').insert(payload)

  if (result.error && isMissingPassiveReactivateColumnError(result.error)) {
    if (!warnedReactivateColumn) {
      warnedReactivateColumn = true
      warnMissingReactivateColumnOnce()
    }
    payload = stripPassiveReactivateDayKey(row)
    result = await supabase.from('game_states').insert(payload)
  }

  if (result.error && isMissingShareRewardColumnError(result.error)) {
    if (!warnedShareColumn) {
      warnedShareColumn = true
      warnMissingShareColumnOnce()
    }
    payload = stripShareRewardDayKey(payload)
    result = await supabase.from('game_states').insert(payload)
  }

  if (result.error && isMissingPassiveCoffeesClaimedColumnError(result.error)) {
    if (!warnedPassiveColumn) {
      warnedPassiveColumn = true
      warnMissingPassiveColumnOnce()
    }
    payload = stripPassiveCoffeesClaimed(stripShareRewardDayKey(stripPassiveReactivateDayKey(row)))
    result = await supabase.from('game_states').insert(payload)
  }

  return result
}

async function upsertGameRow(supabase, row, options) {
  let payload = row
  let result = await supabase.from('game_states').upsert(payload, options)

  if (result.error && isMissingPassiveReactivateColumnError(result.error)) {
    if (!warnedReactivateColumn) {
      warnedReactivateColumn = true
      warnMissingReactivateColumnOnce()
    }
    payload = stripPassiveReactivateDayKey(row)
    result = await supabase.from('game_states').upsert(payload, options)
  }

  if (result.error && isMissingShareRewardColumnError(result.error)) {
    if (!warnedShareColumn) {
      warnedShareColumn = true
      warnMissingShareColumnOnce()
    }
    payload = stripShareRewardDayKey(payload)
    result = await supabase.from('game_states').upsert(payload, options)
  }

  if (result.error && isMissingPassiveCoffeesClaimedColumnError(result.error)) {
    if (!warnedPassiveColumn) {
      warnedPassiveColumn = true
      warnMissingPassiveColumnOnce()
    }
    payload = stripPassiveCoffeesClaimed(stripShareRewardDayKey(stripPassiveReactivateDayKey(row)))
    result = await supabase.from('game_states').upsert(payload, options)
  }

  return result
}

async function selectGameRow(supabase, userId) {
  let result = await supabase
    .from('game_states')
    .select(GAME_STATE_COLUMNS_FULL)
    .eq('user_id', userId)
    .maybeSingle()

  if (result.error && isMissingPassiveReactivateColumnError(result.error)) {
    if (!warnedReactivateColumn) {
      warnedReactivateColumn = true
      warnMissingReactivateColumnOnce()
    }
    result = await supabase
      .from('game_states')
      .select(GAME_STATE_COLUMNS_WITH_SHARE)
      .eq('user_id', userId)
      .maybeSingle()
  }

  if (result.error && isMissingShareRewardColumnError(result.error)) {
    if (!warnedShareColumn) {
      warnedShareColumn = true
      warnMissingShareColumnOnce()
    }
    result = await supabase
      .from('game_states')
      .select(GAME_STATE_COLUMNS_WITH_PASSIVE_CLAIM)
      .eq('user_id', userId)
      .maybeSingle()
  }

  if (result.error && isMissingPassiveCoffeesClaimedColumnError(result.error)) {
    if (!warnedPassiveColumn) {
      warnedPassiveColumn = true
      warnMissingPassiveColumnOnce()
    }
    result = await supabase
      .from('game_states')
      .select(GAME_STATE_COLUMNS_CORE)
      .eq('user_id', userId)
      .maybeSingle()
  }

  return result
}

function passiveGrowthChanged(before, after) {
  return (
    before.growth !== after.growth ||
    before.dailyPassiveGrowth !== after.dailyPassiveGrowth ||
    before.growthAccrualSyncedAt !== after.growthAccrualSyncedAt ||
    before.passiveDayKey !== after.passiveDayKey
  )
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
    return settleAndPersistPassiveGrowth(userId, db.gameStates[userId])
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

    return settlePassiveGrowth({ ...initialGameState })
  }

  return settleAndPersistPassiveGrowth(userId, mapGameRow(data))
}

export async function saveGameState(userId, state) {
  const next = normalizeGameState(state)

  if (!isSupabaseAdminConfigured()) {
    patchLocalDb((db) => {
      db.gameStates[userId] = next
    })
    return next
  }

  const supabase = getSupabaseAdmin()
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
