import type { DailyPlayQuotas } from './dailyGamePlayQuota';
import { getFreshPlayQuotas } from './dailyGamePlayQuota';

export const DAILY_GAME_STORAGE_KEY = 'grow-coffee-daily-games';

export type DailyMissions = {
  date: string;
  mission1: number;
  mission2: number;
  mission3: number;
  mission4: number;
  memoryMission1: number;
  memoryMission2: number;
  memoryMission3: number;
  memoryMission4: number;
  pairMission1: number;
  pairMission2: number;
  pairMission3: number;
  pairMission4: number;
};

export type GameMemoryStats = {
  date: string;
  plays: number;
  wins: number;
  bestMoves: number;
  bestStage: number;
  omok: { plays: number; wins: number; bestStage: number };
  pairMatch: { plays: number; wins: number; bestStage: number };
};

export type DailyGameSave = {
  daily: DailyMissions;
  memory: GameMemoryStats;
  playQuotas: DailyPlayQuotas;
};

export const DEFAULT_DAILY: DailyMissions = {
  date: '',
  mission1: 0,
  mission2: 0,
  mission3: 0,
  mission4: 0,
  memoryMission1: 0,
  memoryMission2: 0,
  memoryMission3: 0,
  memoryMission4: 0,
  pairMission1: 0,
  pairMission2: 0,
  pairMission3: 0,
  pairMission4: 0,
};

export const DEFAULT_MEMORY: GameMemoryStats = {
  date: '',
  plays: 0,
  wins: 0,
  bestMoves: 0,
  bestStage: 0,
  omok: { plays: 0, wins: 0, bestStage: 0 },
  pairMatch: { plays: 0, wins: 0, bestStage: 0 },
};

export function getTodayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${date}`;
}

export function getFreshDaily(daily?: Partial<DailyMissions> | null): DailyMissions {
  const today = getTodayKey();
  if (daily?.date === today) {
    return { ...DEFAULT_DAILY, ...daily };
  }
  return { ...DEFAULT_DAILY, date: today };
}

export function getFreshMemory(memory?: Partial<GameMemoryStats> | null): GameMemoryStats {
  const today = getTodayKey();

  if (memory?.date === today) {
    return {
      ...DEFAULT_MEMORY,
      ...memory,
      omok: { ...DEFAULT_MEMORY.omok, ...memory.omok },
      pairMatch: { ...DEFAULT_MEMORY.pairMatch, ...memory.pairMatch },
    };
  }

  return {
    ...DEFAULT_MEMORY,
    date: today,
    wins: memory?.wins ?? 0,
    bestMoves: memory?.bestMoves ?? 0,
    bestStage: memory?.bestStage ?? 0,
    omok: {
      ...DEFAULT_MEMORY.omok,
      wins: memory?.omok?.wins ?? 0,
      bestStage: memory?.omok?.bestStage ?? 0,
    },
    pairMatch: {
      ...DEFAULT_MEMORY.pairMatch,
      wins: memory?.pairMatch?.wins ?? 0,
      bestStage: memory?.pairMatch?.bestStage ?? 0,
    },
  };
}

export function loadDailyGameSave(): DailyGameSave {
  try {
    const raw = localStorage.getItem(DAILY_GAME_STORAGE_KEY);
    if (!raw) {
      const today = getTodayKey();
      return {
        daily: { ...DEFAULT_DAILY, date: today },
        memory: { ...DEFAULT_MEMORY, date: today },
        playQuotas: getFreshPlayQuotas(),
      };
    }

    const parsed = JSON.parse(raw) as Partial<DailyGameSave>;
    return {
      daily: getFreshDaily(parsed.daily),
      memory: getFreshMemory(parsed.memory),
      playQuotas: getFreshPlayQuotas(parsed.playQuotas),
    };
  } catch {
    const today = getTodayKey();
    return {
      daily: { ...DEFAULT_DAILY, date: today },
      memory: { ...DEFAULT_MEMORY, date: today },
      playQuotas: getFreshPlayQuotas(),
    };
  }
}

export function saveDailyGameSave(save: DailyGameSave) {
  localStorage.setItem(DAILY_GAME_STORAGE_KEY, JSON.stringify(save));
}

export const DAILY_GAME_RESET_EVENT = 'grow-coffee-daily-games-reset';

export function createFreshDailyGameSave(): DailyGameSave {
  const today = getTodayKey();
  return {
    daily: { ...DEFAULT_DAILY, date: today },
    memory: { ...DEFAULT_MEMORY, date: today },
    playQuotas: getFreshPlayQuotas(),
  };
}

/** 진행 데이터 초기화 시 1일 1게임 플레이·보상 기록도 함께 리셋 */
export function resetDailyGameSave(): DailyGameSave {
  const fresh = createFreshDailyGameSave();
  saveDailyGameSave(fresh);
  window.dispatchEvent(new CustomEvent(DAILY_GAME_RESET_EVENT));
  return fresh;
}
