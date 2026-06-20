import { randomUUID } from 'node:crypto'
import { initialGameState } from './constants.js'
import { normalizeGameState } from './gameLogic.js'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from './supabase.js'

const profiles = new Map()
const gameStates = new Map()
const lastActionAt = new Map()

function mapProfileRow(row) {
  return {
    userId: row.id,
    displayName: row.display_name,
    source: row.source,
  }
}

function mapGameRow(row) {
  return normalizeGameState({
    growth: row.growth,
    money: row.money,
    totalCoffees: row.total_coffees,
    totalWaters: row.total_waters,
    redeemed: row.redeemed,
  })
}

export function getStorageMode() {
  return isSupabaseAdminConfigured() ? 'supabase' : 'memory'
}

export async function resolveGuestSession(deviceId, displayName) {
  const safeDeviceId = String(deviceId || '').trim()
  const nextDisplayName = String(displayName || '커피 농부').trim().slice(0, 24)

  if (!safeDeviceId) {
    throw new Error('deviceId가 필요합니다.')
  }

  if (!isSupabaseAdminConfigured()) {
    const existing = [...profiles.values()].find((profile) => profile.deviceId === safeDeviceId)

    if (existing) {
      return {
        userId: existing.userId,
        displayName: existing.displayName,
        source: 'guest',
      }
    }

    const userId = randomUUID()
    profiles.set(userId, {
      userId,
      deviceId: safeDeviceId,
      displayName: nextDisplayName,
      source: 'guest',
    })
    gameStates.set(userId, { ...initialGameState })

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

  const { error: gameError } = await supabase.from('game_states').insert({
    user_id: userId,
    ...toGameRow(initialGameState),
  })

  if (gameError) {
    throw gameError
  }

  return { userId, displayName: nextDisplayName, source: 'guest' }
}

function toGameRow(state) {
  const current = normalizeGameState(state)

  return {
    growth: current.growth,
    money: current.money,
    total_coffees: current.totalCoffees,
    total_waters: current.totalWaters,
    redeemed: current.redeemed,
  }
}

export async function getGameState(userId) {
  if (!isSupabaseAdminConfigured()) {
    return normalizeGameState(gameStates.get(userId) ?? initialGameState)
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('game_states')
    .select('growth, money, total_coffees, total_waters, redeemed')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    const { error: insertError } = await supabase.from('game_states').insert({
      user_id: userId,
      ...toGameRow(initialGameState),
    })

    if (insertError) {
      throw insertError
    }

    return { ...initialGameState }
  }

  return mapGameRow(data)
}

export async function saveGameState(userId, state) {
  const next = normalizeGameState(state)

  if (!isSupabaseAdminConfigured()) {
    gameStates.set(userId, next)
    return next
  }

  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('game_states').upsert(
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
  return lastActionAt.get(userId) ?? 0
}

export function setLastActionAt(userId, timestamp) {
  lastActionAt.set(userId, timestamp)
}
