export const PAIR_ICONS = ['☕', '🫘', '🌱', '☀️', '🍪', '💎', '🧺', '🥣'];

export type PairMissionKey = 'pairMission1' | 'pairMission2' | 'pairMission3';

export type PairCard = {
  id: string;
  icon: string;
  matched: boolean;
};

export const PAIR_DIFFICULTIES = [
  {
    id: 'easy',
    label: '쉬움',
    emoji: '🌱',
    missionKey: 'pairMission1' as PairMissionKey,
    reward: 0.005,
    pairCount: 3,
    timeLimit: 30,
    description: '3쌍 · 30초 안에 매칭',
  },
  {
    id: 'medium',
    label: '중간',
    emoji: '⚡',
    missionKey: 'pairMission2' as PairMissionKey,
    reward: 0.01,
    pairCount: 4,
    timeLimit: 24,
    description: '4쌍 · 24초 · 집중력 테스트',
  },
  {
    id: 'hard',
    label: '어려움',
    emoji: '🔥',
    missionKey: 'pairMission3' as PairMissionKey,
    reward: 0.015,
    pairCount: 5,
    timeLimit: 20,
    description: '5쌍 · 20초 · 빠른 기억력',
  },
] as const;

function shuffle<T>(list: T[]) {
  const next = [...list];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

export function createPairBoard(pairCount: number): PairCard[] {
  const icons = shuffle(PAIR_ICONS.slice(0, pairCount));
  return shuffle(
    icons.flatMap((icon, index) => [
      { id: `${icon}-a-${index}`, icon, matched: false },
      { id: `${icon}-b-${index}`, icon, matched: false },
    ]),
  );
}

export function getPairDifficulty(id: string | null) {
  return PAIR_DIFFICULTIES.find((item) => item.id === id) ?? PAIR_DIFFICULTIES[0];
}
