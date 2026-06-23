import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_MEMORY,
  getFreshDaily,
  getFreshMemory,
  loadDailyGameSave,
  saveDailyGameSave,
  type DailyMissions,
  type GameMemoryStats,
} from '../services/dailyGameStorage';

export type MissionKey = Exclude<keyof DailyMissions, 'date'>;

export type StatsUpdatePayload = {
  clearedStage: number;
  completedAll: boolean;
  startedNewRun: boolean;
};

export function useDailyGame() {
  const [save, setSave] = useState(loadDailyGameSave);
  const [message, setMessage] = useState<string | null>(null);

  const daily = useMemo(() => getFreshDaily(save.daily), [save.daily]);
  const memory = useMemo(() => getFreshMemory(save.memory), [save.memory]);
  const pairMatch = memory.pairMatch;

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(null), 2800);
    return () => window.clearTimeout(timer);
  }, [message]);

  const persist = useCallback((nextDaily: DailyMissions, nextMemory: GameMemoryStats) => {
    const payload = { daily: nextDaily, memory: nextMemory };
    setSave(payload);
    saveDailyGameSave(payload);
  }, []);

  const rewardMission = useCallback(
    (missionKey: MissionKey, reward: number, successMessage?: string) => {
      const currentDaily = getFreshDaily(daily);

      if (currentDaily[missionKey] >= 1) {
        setMessage('오늘 이 미션 보상은 이미 받았어요.');
        return;
      }

      setMessage(
        successMessage
          ? `${successMessage} (+${reward.toFixed(3)}KG)`
          : `미션 성공! 보상을 받았어요. (+${reward.toFixed(3)}KG)`,
      );

      persist({ ...currentDaily, [missionKey]: 1 }, memory);
    },
    [daily, memory, persist],
  );

  const updateOmokStats = useCallback(
    ({ clearedStage, completedAll, startedNewRun }: StatsUpdatePayload) => {
      const currentMemory = getFreshMemory(memory);
      const currentOmok = currentMemory.omok ?? DEFAULT_MEMORY.omok;

      persist(daily, {
        ...currentMemory,
        omok: {
          ...currentOmok,
          plays: startedNewRun ? currentOmok.plays + 1 : currentOmok.plays,
          wins: completedAll ? currentOmok.wins + 1 : currentOmok.wins,
          bestStage: startedNewRun
            ? currentOmok.bestStage ?? 0
            : Math.max(currentOmok.bestStage ?? 0, clearedStage),
        },
      });
    },
    [daily, memory, persist],
  );

  const updateMemoryStats = useCallback(
    ({ clearedStage, completedAll, startedNewRun }: StatsUpdatePayload) => {
      const currentMemory = getFreshMemory(memory);

      persist(daily, {
        ...currentMemory,
        plays: startedNewRun ? currentMemory.plays + 1 : currentMemory.plays,
        wins: completedAll ? currentMemory.wins + 1 : currentMemory.wins,
        bestStage: startedNewRun
          ? currentMemory.bestStage ?? 0
          : Math.max(currentMemory.bestStage ?? 0, clearedStage),
      });
    },
    [daily, memory, persist],
  );

  const updatePairMatchStats = useCallback(
    ({ clearedStage, completedAll, startedNewRun }: StatsUpdatePayload) => {
      const currentMemory = getFreshMemory(memory);
      const currentPair = currentMemory.pairMatch ?? DEFAULT_MEMORY.pairMatch;

      persist(daily, {
        ...currentMemory,
        pairMatch: {
          ...currentPair,
          plays: startedNewRun ? currentPair.plays + 1 : currentPair.plays,
          wins: completedAll ? currentPair.wins + 1 : currentPair.wins,
          bestStage: startedNewRun
            ? currentPair.bestStage ?? 0
            : Math.max(currentPair.bestStage ?? 0, clearedStage),
        },
      });
    },
    [daily, memory, persist],
  );

  return {
    daily,
    memory,
    pairMatch,
    message,
    setMessage,
    rewardMission,
    updateOmokStats,
    updateMemoryStats,
    updatePairMatchStats,
  };
}
