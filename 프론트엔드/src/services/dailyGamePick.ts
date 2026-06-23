import type { DailyMissions, GameMemoryStats } from './dailyGameStorage';
import { getTodayKey } from './dailyGameStorage';

export type DailyGameId = 'omok' | 'sequence' | 'pair';

export type DailyGameMeta = {
  id: DailyGameId;
  number: number;
  icon: string;
  title: string;
  subtitle: string;
  reward: string;
  progress: (daily: DailyMissions) => string;
};

export const DAILY_GAMES: DailyGameMeta[] = [
  {
    id: 'omok',
    number: 1,
    icon: '⚫',
    title: 'AI 오목 대전',
    subtitle: '2D 바둑판 · 4단계 · 수 제한',
    reward: '최고 +0.05KG',
    progress: (daily) => {
      const done = [daily.mission1, daily.mission2, daily.mission3, daily.mission4].filter((v) => v >= 1).length;
      return `${done}/4 보상`;
    },
  },
  {
    id: 'sequence',
    number: 2,
    icon: '🧠',
    title: '순서 기억 챌린지',
    subtitle: '12칸 격자 · 3단계 · 시간 제한',
    reward: '최고 +0.015KG',
    progress: (daily) => {
      const done = [daily.memoryMission1, daily.memoryMission2, daily.memoryMission3].filter((v) => v >= 1).length;
      return `${done}/3 보상`;
    },
  },
  {
    id: 'pair',
    number: 3,
    icon: '🃏',
    title: '카드 짝 맞추기',
    subtitle: '2D 카드 뒤집기 · 3단계 · 시간 제한',
    reward: '최고 +0.015KG',
    progress: (daily) => {
      const done = [daily.pairMission1, daily.pairMission2, daily.pairMission3].filter((v) => v >= 1).length;
      return `${done}/3 보상`;
    },
  },
];

const GAME_IDS = DAILY_GAMES.map((game) => game.id);

export function getDailyRecommendedGameId(dateKey = getTodayKey()): DailyGameId {
  let hash = 0;
  for (const char of dateKey) {
    hash = (hash * 31 + char.charCodeAt(0)) % 997;
  }
  return GAME_IDS[hash % GAME_IDS.length];
}

export function getDailyRecommendedGame(dateKey = getTodayKey()) {
  const id = getDailyRecommendedGameId(dateKey);
  return DAILY_GAMES.find((game) => game.id === id) ?? DAILY_GAMES[0];
}

export function getGameRecordLabel(gameId: DailyGameId, memory: GameMemoryStats) {
  const omok = memory.omok ?? { wins: 0, bestStage: 0, plays: 0 };
  const pairMatch = memory.pairMatch ?? { wins: 0, bestStage: 0, plays: 0 };

  if (gameId === 'omok') {
    return `승 ${omok.wins} · 최고 난이도 ${omok.bestStage || 0} · ${omok.plays}판`;
  }

  if (gameId === 'sequence') {
    return `승 ${memory.wins ?? 0} · 최고 난이도 ${memory.bestStage ?? 0} · ${memory.plays ?? 0}판`;
  }

  return `승 ${pairMatch.wins ?? 0} · 최고 난이도 ${pairMatch.bestStage ?? 0} · ${pairMatch.plays ?? 0}판`;
}
