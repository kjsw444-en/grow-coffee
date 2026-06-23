import { getSupabaseAdmin, isSupabaseAdminConfigured } from './supabase.js'
import { patchLocalDb, readLocalDb } from './store.js'

const RANKING_SIZE = 50

function mapRankingRows(rows, userId) {
  return rows.map((entry, index) => ({
    id: entry.user_id,
    name: entry.display_name,
    spentCoffeeCups: Number(entry.spent_coffee_cups),
    rank: index + 1,
    isPlayer: userId ? entry.user_id === userId : false,
  }))
}

function readLocalRankings() {
  const db = readLocalDb()
  return Object.entries(db.rankings).map(([userId, row]) => ({
    user_id: userId,
    display_name: row.displayName,
    spent_coffee_cups: Number(row.spentCoffeeCups ?? 0),
    updated_at: row.updatedAt ?? '',
  }))
}

async function fetchRankedEntries() {
  if (!isSupabaseAdminConfigured()) {
    return readLocalRankings().sort(
      (a, b) => Number(b.spent_coffee_cups) - Number(a.spent_coffee_cups),
    )
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('rankings')
    .select('user_id, display_name, spent_coffee_cups, updated_at')
    .order('spent_coffee_cups', { ascending: false })

  if (error) {
    throw error
  }

  return data ?? []
}

export async function getTop50Rankings(userId) {
  const ranked = await fetchRankedEntries()
  const top50 = mapRankingRows(ranked.slice(0, RANKING_SIZE), userId)

  return {
    ok: true,
    top50,
    totalPlayers: ranked.length,
    updatedAt: Date.now(),
  }
}

export async function getPlayerRank(userId) {
  if (!userId) {
    return null
  }

  const ranked = await fetchRankedEntries()
  const index = ranked.findIndex((entry) => entry.user_id === userId)
  return index >= 0 ? index + 1 : null
}

export async function submitRanking(userId, spentCoffeeCups, displayName) {
  const safeScore = Math.max(0, Math.floor(Number(spentCoffeeCups) || 0))
  const safeName = String(displayName || '커피 농부').trim().slice(0, 24)
  const updatedAt = new Date().toISOString()

  if (!isSupabaseAdminConfigured()) {
    patchLocalDb((db) => {
      const current = db.rankings[userId]
      const nextScore = Math.max(Number(current?.spentCoffeeCups ?? 0), safeScore)

      db.rankings[userId] = {
        displayName: safeName,
        spentCoffeeCups: nextScore,
        updatedAt,
      }
    })
  } else {
    const supabase = getSupabaseAdmin()
    const { data: existing, error: lookupError } = await supabase
      .from('rankings')
      .select('spent_coffee_cups')
      .eq('user_id', userId)
      .maybeSingle()

    if (lookupError) {
      throw lookupError
    }

    const nextScore = Math.max(Number(existing?.spent_coffee_cups ?? 0), safeScore)

    const { error: rankingError } = await supabase.from('rankings').upsert(
      {
        user_id: userId,
        display_name: safeName,
        spent_coffee_cups: nextScore,
        updated_at: updatedAt,
      },
      { onConflict: 'user_id' },
    )

    if (rankingError) {
      throw rankingError
    }

    await supabase.from('profiles').update({ display_name: safeName }).eq('id', userId)
  }

  const ranked = await fetchRankedEntries()
  const playerIndex = ranked.findIndex((entry) => entry.user_id === userId)
  const playerRank = playerIndex >= 0 ? playerIndex + 1 : ranked.length + 1

  return {
    ok: true,
    playerRank,
    playerSpentCoffeeCups: safeScore,
    inTop50: playerRank <= RANKING_SIZE,
    top50: mapRankingRows(ranked.slice(0, RANKING_SIZE), userId),
    totalPlayers: ranked.length,
  }
}

/** drink / 상점 구매 후 랭킹 점수 자동 반영 (goldcat submit 패턴) */
export async function syncRankingFromGameState(userId, state, displayName) {
  const spentCoffeeCups = Number(state?.spentCoffeeCups ?? 0)
  if (!userId || spentCoffeeCups <= 0) {
    return null
  }

  return submitRanking(userId, spentCoffeeCups, displayName)
}
