import { getDailyRankingBrewedSpend } from './gameLogic.js'
import { getPromotionClaim, RANKING_TOP3_CLAIM_TYPE } from './promotionClaims.js'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from './supabase.js'
import { patchLocalDb, readLocalDb } from './store.js'
import { getTodayKey, getYesterdayKey } from './waterQuota.js'

const RANKING_SIZE = 50
const RANKING_TOP3_REWARD_AMOUNT = 4700

function isMissingRankingDayKeyColumnError(error) {
  return String(error?.message ?? '').includes('day_key')
}

function isMissingRankingDailyEntriesTableError(error) {
  const message = String(error?.message ?? '')
  return message.includes('ranking_daily_entries')
}

function getKstDayRange(dayKey) {
  const start = new Date(`${dayKey}T00:00:00+09:00`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start: start.toISOString(), end: end.toISOString() }
}

function dailyEntryKey(userId, dayKey) {
  return `${userId}:${dayKey}`
}

function mapRankingRows(rows, userId) {
  return rows.map((entry, index) => ({
    id: entry.user_id,
    name: entry.display_name,
    spentCoffeeCups: Number(entry.spent_coffee_cups),
    rank: index + 1,
    isPlayer: userId ? entry.user_id === userId : false,
  }))
}

function readLocalDailyEntries(dayKey) {
  const db = readLocalDb()
  return Object.values(db.rankingDailyEntries ?? {})
    .filter((row) => String(row.dayKey ?? '') === dayKey)
    .map((row) => ({
      user_id: row.userId,
      display_name: row.displayName,
      spent_coffee_cups: Number(row.spentCoffeeCups ?? 0),
      updated_at: row.updatedAt ?? '',
    }))
}

function upsertLocalDailyEntry(userId, dayKey, spentCoffeeCups, displayName, updatedAt) {
  patchLocalDb((db) => {
    db.rankingDailyEntries ??= {}
    db.rankingDailyEntries[dailyEntryKey(userId, dayKey)] = {
      userId,
      dayKey,
      displayName,
      spentCoffeeCups,
      updatedAt,
    }
  })
}

async function upsertDailyRankingEntry(userId, dayKey, spentCoffeeCups, displayName, updatedAt) {
  upsertLocalDailyEntry(userId, dayKey, spentCoffeeCups, displayName, updatedAt)

  if (!isSupabaseAdminConfigured()) {
    return
  }

  const supabase = getSupabaseAdmin()
  const row = {
    user_id: userId,
    day_key: dayKey,
    display_name: displayName,
    spent_coffee_cups: spentCoffeeCups,
    updated_at: updatedAt,
  }

  const { error } = await supabase.from('ranking_daily_entries').upsert(row, {
    onConflict: 'user_id,day_key',
  })

  if (error && !isMissingRankingDailyEntriesTableError(error)) {
    throw error
  }
}

function readLocalRankings(dayKey = getTodayKey()) {
  const daily = readLocalDailyEntries(dayKey)
  if (daily.length > 0) {
    return daily
  }

  const db = readLocalDb()
  const { start, end } = getKstDayRange(dayKey)
  return Object.entries(db.rankings)
    .filter(([, row]) => {
      if (String(row.dayKey ?? '') === dayKey) return true
      const updatedAt = new Date(row.updatedAt ?? 0).toISOString()
      return updatedAt >= start && updatedAt < end
    })
    .map(([userId, row]) => ({
      user_id: userId,
      display_name: row.displayName,
      spent_coffee_cups: Number(row.spentCoffeeCups ?? 0),
      updated_at: row.updatedAt ?? '',
    }))
}

async function fetchDailyRankingEntries(dayKey) {
  if (!isSupabaseAdminConfigured()) {
    return readLocalDailyEntries(dayKey)
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('ranking_daily_entries')
    .select('user_id, display_name, spent_coffee_cups, updated_at')
    .eq('day_key', dayKey)
    .order('spent_coffee_cups', { ascending: false })

  if (error) {
    if (isMissingRankingDailyEntriesTableError(error)) {
      return []
    }
    throw error
  }

  return data ?? []
}

async function fetchRankedEntries(dayKey = getTodayKey()) {
  const dailyEntries = await fetchDailyRankingEntries(dayKey)
  if (dailyEntries.length > 0) {
    return dailyEntries.sort(
      (a, b) => Number(b.spent_coffee_cups) - Number(a.spent_coffee_cups),
    )
  }

  if (!isSupabaseAdminConfigured()) {
    return readLocalRankings(dayKey).sort(
      (a, b) => Number(b.spent_coffee_cups) - Number(a.spent_coffee_cups),
    )
  }

  const supabase = getSupabaseAdmin()
  const { start, end } = getKstDayRange(dayKey)
  const { data, error } = await supabase
    .from('rankings')
    .select('user_id, display_name, spent_coffee_cups, updated_at')
    .gte('updated_at', start)
    .lt('updated_at', end)
    .order('spent_coffee_cups', { ascending: false })

  if (error) {
    throw error
  }

  return data ?? []
}

export async function getTop50Rankings(userId) {
  const dayKey = getTodayKey()
  const ranked = await fetchRankedEntries(dayKey)
  const top50 = mapRankingRows(ranked.slice(0, RANKING_SIZE), userId)

  return {
    ok: true,
    top50,
    totalPlayers: ranked.length,
    dayKey,
    updatedAt: Date.now(),
  }
}

export async function getPlayerRank(userId, dayKey = getTodayKey()) {
  if (!userId) {
    return null
  }

  const ranked = await fetchRankedEntries(dayKey)
  const index = ranked.findIndex((entry) => entry.user_id === userId)
  return index >= 0 ? index + 1 : null
}

export async function getRankingTop3RewardStatus(userId) {
  const rewardDayKey = getYesterdayKey()

  if (!userId) {
    return {
      rewardDayKey,
      playerRank: null,
      eligible: false,
      claimed: false,
      canClaim: false,
    }
  }

  const ranked = await fetchRankedEntries(rewardDayKey)
  const index = ranked.findIndex((entry) => entry.user_id === userId)
  const playerRank = index >= 0 ? index + 1 : null
  const eligible = playerRank != null && playerRank >= 1 && playerRank <= 3
  const existing = await getPromotionClaim(userId, RANKING_TOP3_CLAIM_TYPE, rewardDayKey)
  const claimed = Boolean(existing)

  return {
    rewardDayKey,
    playerRank,
    eligible,
    claimed,
    canClaim: eligible && !claimed,
  }
}

/** DEV — 오늘 랭킹 스냅샷을 어제(마감) 랭킹으로 복사해 보상 테스트 */
export async function finalizeDailyRankingForDev(userId, displayName, playerScore) {
  const todayKey = getTodayKey()
  const yesterdayKey = getYesterdayKey()
  const updatedAt = new Date().toISOString()
  const safeName = String(displayName || '커피 농부').trim().slice(0, 24)
  let safeScore = Math.max(0, Math.floor(Number(playerScore) || 0))

  if (userId) {
    if (safeScore <= 0) {
      safeScore = 100
    }
    await upsertDailyRankingEntry(userId, todayKey, safeScore, safeName, updatedAt)
  }

  const todayEntries = await fetchRankedEntries(todayKey)

  for (const entry of todayEntries) {
    await upsertDailyRankingEntry(
      entry.user_id,
      yesterdayKey,
      Number(entry.spent_coffee_cups ?? 0),
      String(entry.display_name || '커피 농부').trim().slice(0, 24),
      entry.updated_at || updatedAt,
    )
  }

  const rewardStatus = userId
    ? await getRankingTop3RewardStatus(userId)
    : {
        rewardDayKey: yesterdayKey,
        playerRank: null,
        eligible: false,
        claimed: false,
        canClaim: false,
      }

  return {
    ok: true,
    finalizedDayKey: yesterdayKey,
    sourceDayKey: todayKey,
    entryCount: todayEntries.length,
    rewardStatus,
  }
}

export async function submitRanking(userId, spentCoffeeCups, displayName) {
  const safeScore = Math.max(0, Math.floor(Number(spentCoffeeCups) || 0))
  const safeName = String(displayName || '커피 농부').trim().slice(0, 24)
  const dayKey = getTodayKey()
  const updatedAt = new Date().toISOString()

  await upsertDailyRankingEntry(userId, dayKey, safeScore, safeName, updatedAt)

  if (!isSupabaseAdminConfigured()) {
    patchLocalDb((db) => {
      db.rankings[userId] = {
        displayName: safeName,
        spentCoffeeCups: safeScore,
        dayKey,
        updatedAt,
      }
    })
  } else {
    const supabase = getSupabaseAdmin()

    const rankingRow = {
      user_id: userId,
      display_name: safeName,
      spent_coffee_cups: safeScore,
      day_key: dayKey,
      updated_at: updatedAt,
    }

    let { error: rankingError } = await supabase.from('rankings').upsert(rankingRow, {
      onConflict: 'user_id',
    })

    if (rankingError && isMissingRankingDayKeyColumnError(rankingError)) {
      const { day_key: _dayKey, ...legacyRankingRow } = rankingRow
      const retry = await supabase.from('rankings').upsert(legacyRankingRow, {
        onConflict: 'user_id',
      })
      rankingError = retry.error
    }

    if (rankingError) {
      throw rankingError
    }

    await supabase.from('profiles').update({ display_name: safeName }).eq('id', userId)
  }

  const ranked = await fetchRankedEntries(dayKey)
  const playerIndex = ranked.findIndex((entry) => entry.user_id === userId)
  const playerRank = playerIndex >= 0 ? playerIndex + 1 : ranked.length + 1
  const storedScore =
    playerIndex >= 0 ? Number(ranked[playerIndex].spent_coffee_cups ?? safeScore) : safeScore

  return {
    ok: true,
    playerRank,
    playerSpentCoffeeCups: storedScore,
    inTop50: playerRank <= RANKING_SIZE,
    top50: mapRankingRows(ranked.slice(0, RANKING_SIZE), userId),
    totalPlayers: ranked.length,
    dayKey,
  }
}

/** 오늘 받은 내린 커피 잔 수를 일일 랭킹 점수로 동기화 */
export async function syncRankingFromGameState(userId, state, displayName) {
  if (!userId) {
    return null
  }

  return submitRanking(userId, getDailyRankingBrewedSpend(state), displayName)
}

export { RANKING_TOP3_REWARD_AMOUNT }
