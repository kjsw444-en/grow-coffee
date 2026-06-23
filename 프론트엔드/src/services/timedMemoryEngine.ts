export const GRID_COLS = 4;
export const GRID_ROWS = 3;
export const CELL_COUNT = GRID_COLS * GRID_ROWS;

export type MemoryMissionKey = 'memoryMission1' | 'memoryMission2' | 'memoryMission3';

export const MEMORY_DIFFICULTIES = [
  {
    id: 'easy',
    label: '쉬움',
    emoji: '🌱',
    missionKey: 'memoryMission1' as MemoryMissionKey,
    reward: 0.005,
    count: 4,
    recallTime: 15,
    flashMs: 700,
    description: '4칸 순서 · 15초 안에 입력',
  },
  {
    id: 'medium',
    label: '중간',
    emoji: '⚡',
    missionKey: 'memoryMission2' as MemoryMissionKey,
    reward: 0.01,
    count: 6,
    recallTime: 11,
    flashMs: 600,
    description: '6칸 순서 · 11초 · 위치 기억',
  },
  {
    id: 'hard',
    label: '어려움',
    emoji: '🔥',
    missionKey: 'memoryMission3' as MemoryMissionKey,
    reward: 0.015,
    count: 7,
    recallTime: 9,
    flashMs: 550,
    description: '7칸 순서 · 9초 · 강한 집중력',
  },
] as const;

export function getCellNumber(cellIndex: number) {
  return cellIndex + 1;
}

export function createRandomSequence(count: number) {
  const indices = Array.from({ length: CELL_COUNT }, (_, index) => index);
  const sequence: number[] = [];

  for (let step = 0; step < count; step += 1) {
    const pickIndex = Math.floor(Math.random() * indices.length);
    sequence.push(indices[pickIndex]);
    indices.splice(pickIndex, 1);
  }

  return sequence;
}

export function getMemoryDifficulty(id: string | null) {
  return MEMORY_DIFFICULTIES.find((item) => item.id === id) ?? MEMORY_DIFFICULTIES[0];
}
