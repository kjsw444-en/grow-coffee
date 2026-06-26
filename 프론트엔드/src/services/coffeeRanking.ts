import {
  fetchTopRanking,
  submitCoffeeRanking,
  type RankingEntry,
} from './api'

export const COFFEE_RANKING_SIZE = 50

export type CoffeeRankingView = {
  top50: RankingEntry[]
  playerRank: number
  playerSpentCoffeeCups: number
  inTop50: boolean
  totalPlayers: number
  dayKey?: string
  live: boolean
}

const SEED_NAMES = [
  '커피왕',
  '라떼마스터',
  '아메리카노',
  '에스프레소',
  '카페인중독',
  '원두수집가',
  '쓰담쓰담',
  '출석왕',
  '오목고수',
  '기억력왕',
]

function createLocalRanking(spentCoffeeCups: number, playerName = '나'): CoffeeRankingView {
  const safeScore = Math.max(0, Math.floor(spentCoffeeCups))
  const playerEntry = {
    id: 'local-player',
    name: playerName,
    spentCoffeeCups: safeScore,
    isPlayer: true,
  }

  const seeded = SEED_NAMES.map((name, index) => ({
    id: `npc-${index}`,
    name,
    spentCoffeeCups: Math.max(0, 500 - index * 42),
    isPlayer: false,
  }))

  const ranked = [...seeded, playerEntry]
    .sort((left, right) => right.spentCoffeeCups - left.spentCoffeeCups)
    .map((entry, index) => ({ ...entry, rank: index + 1 }))

  const playerRank = ranked.find((entry) => entry.isPlayer)?.rank ?? ranked.length

  return {
    top50: ranked.slice(0, COFFEE_RANKING_SIZE),
    playerRank,
    playerSpentCoffeeCups: safeScore,
    inTop50: playerRank <= COFFEE_RANKING_SIZE,
    totalPlayers: ranked.length,
    dayKey: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }),
    live: false,
  }
}

export function getCoffeeRanking(spentCoffeeCups: number, playerName = '나') {
  return createLocalRanking(spentCoffeeCups, playerName)
}

export async function syncCoffeeRanking({
  userId,
  spentCoffeeCups,
  displayName = '나',
}: {
  userId: string
  spentCoffeeCups: number
  displayName?: string
}): Promise<CoffeeRankingView> {
  const fallback = createLocalRanking(spentCoffeeCups, displayName)

  if (!userId) {
    return fallback
  }

  try {
    const result = await submitCoffeeRanking({
      spentCoffeeCups,
      displayName,
    })

    return {
      top50: result.top50.map((entry) => ({
        ...entry,
        isPlayer: entry.isPlayer ?? entry.id === userId,
      })),
      playerRank: result.playerRank,
      playerSpentCoffeeCups: result.playerSpentCoffeeCups,
      inTop50: result.inTop50,
      totalPlayers: result.totalPlayers,
      dayKey: result.dayKey,
      live: true,
    }
  } catch {
    try {
      const remote = await fetchTopRanking()
      const playerEntry = {
        id: userId,
        name: displayName,
        spentCoffeeCups: Math.max(0, Math.floor(spentCoffeeCups)),
        isPlayer: true,
      }

      const merged = [...remote.top50, playerEntry]
        .sort((left, right) => right.spentCoffeeCups - left.spentCoffeeCups)
        .slice(0, COFFEE_RANKING_SIZE)
        .map((entry, index) => ({
          ...entry,
          rank: index + 1,
          isPlayer: entry.id === userId,
        }))

      const playerRank = merged.find((entry) => entry.id === userId)?.rank ?? merged.length + 1

      return {
        top50: merged,
        playerRank,
        playerSpentCoffeeCups: playerEntry.spentCoffeeCups,
        inTop50: playerRank <= COFFEE_RANKING_SIZE,
        totalPlayers: remote.totalPlayers,
        dayKey: remote.dayKey,
        live: true,
      }
    } catch {
      return fallback
    }
  }
}
