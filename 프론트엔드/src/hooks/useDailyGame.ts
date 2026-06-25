import { useCallback, useEffect, useMemo, useState } from 'react';

import {

  canClaimMissionReward,

  consumeMissionAttempt,

  getAttemptRewardSlot,

  getFreshPlayQuotas,

  getMissionPlayStatus,

  markMissionRewardClaimed,

  type DailyPlayQuotas,

  type MinigameRewardSlot,

  type MissionKey,

  type MissionPlayStatus,

} from '../services/dailyGamePlayQuota';

import {

  DEFAULT_MEMORY,

  getFreshDaily,

  getFreshMemory,

  loadDailyGameSave,

  saveDailyGameSave,

  DAILY_GAME_RESET_EVENT,

  type DailyMissions,

  type GameMemoryStats,

} from '../services/dailyGameStorage';
import { formatMinigameRewardLabel, getMinigameRewardCups } from '../services/minigameReward';

export type { MissionKey, MissionPlayStatus, MinigameRewardSlot };



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

  const playQuotas = useMemo(() => getFreshPlayQuotas(save.playQuotas), [save.playQuotas]);

  const pairMatch = memory.pairMatch;



  useEffect(() => {

    if (!message) return undefined;

    const timer = window.setTimeout(() => setMessage(null), 2800);

    return () => window.clearTimeout(timer);

  }, [message]);

  useEffect(() => {
    const reloadDailyGameSave = () => setSave(loadDailyGameSave());
    window.addEventListener(DAILY_GAME_RESET_EVENT, reloadDailyGameSave);
    return () => window.removeEventListener(DAILY_GAME_RESET_EVENT, reloadDailyGameSave);
  }, []);



  const persist = useCallback(
    (nextDaily: DailyMissions, nextMemory: GameMemoryStats, nextPlayQuotas?: DailyPlayQuotas) => {
      setSave((prev) => {
        const payload = {
          daily: nextDaily,
          memory: nextMemory,
          playQuotas: nextPlayQuotas ?? getFreshPlayQuotas(prev.playQuotas),
        };
        saveDailyGameSave(payload);
        return payload;
      });
    },
    [],
  );



  const getMissionPlayStatusFor = useCallback(

    (missionKey: MissionKey): MissionPlayStatus => getMissionPlayStatus(playQuotas, missionKey),

    [playQuotas],

  );



  const beginMissionAttempt = useCallback(

    async (missionKey: MissionKey, onWatchAd: () => Promise<boolean>): Promise<boolean> => {

      const currentQuotas = getFreshPlayQuotas(playQuotas);

      const status = getMissionPlayStatus(currentQuotas, missionKey);



      if (status.state === 'exhausted') {

        setMessage('오늘 이 난이도는 더 이상 플레이할 수 없어요.');

        return false;

      }



      if (status.state === 'ad_required') {
        const watched = await onWatchAd();

        if (!watched) {
          setMessage('광고 시청을 완료해야 다시 도전할 수 있어요.');
          return false;
        }

        persist(daily, memory, consumeMissionAttempt(currentQuotas, missionKey, 'ad'));
        return true;
      }



      persist(daily, memory, consumeMissionAttempt(currentQuotas, missionKey, 'free'));

      return true;

    },

    [daily, memory, persist, playQuotas],

  );



  const rewardMission = useCallback(
    async (
      missionKey: MissionKey,
      _rewardCups: number,
      successMessage?: string,
      grantReward?: (missionKey: MissionKey, rewardSlot: MinigameRewardSlot) => Promise<boolean>,
      rewardSlot: MinigameRewardSlot = 'free',
    ) => {
      const currentQuotas = getFreshPlayQuotas(playQuotas);

      if (!canClaimMissionReward(currentQuotas, missionKey, rewardSlot)) {
        setMessage(
          rewardSlot === 'ad'
            ? '오늘 광고 도전 보상은 이미 받았어요.'
            : '오늘 무료 도전 보상은 이미 받았어요.',
        );
        return;
      }

      if (grantReward) {
        const granted = await grantReward(missionKey, rewardSlot);
        if (!granted) return;
      }

      setMessage(
        successMessage
          ? `${successMessage} (${formatMinigameRewardLabel(getMinigameRewardCups(missionKey))})`
          : `미션 성공! ${formatMinigameRewardLabel(getMinigameRewardCups(missionKey))}을 받았어요.`,
      );

      const nextQuotas = markMissionRewardClaimed(currentQuotas, missionKey, rewardSlot);
      const currentDaily = getFreshDaily(daily);
      const quota = nextQuotas.missions[missionKey];
      const rewardCount =
        Number(quota?.freeRewardClaimed ?? 0) + Number(quota?.adRewardClaimed ?? 0);

      persist({ ...currentDaily, [missionKey]: rewardCount }, memory, nextQuotas);
    },
    [daily, memory, persist, playQuotas],
  );

  const canClaimMissionRewardFor = useCallback(
    (missionKey: MissionKey, rewardSlot: MinigameRewardSlot) =>
      canClaimMissionReward(getFreshPlayQuotas(playQuotas), missionKey, rewardSlot),
    [playQuotas],
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
    playQuotas,
    message,
    setMessage,
    rewardMission,
    canClaimMissionRewardFor,
    getAttemptRewardSlot,
    getMissionPlayStatusFor,
    beginMissionAttempt,
    updateOmokStats,
    updateMemoryStats,
    updatePairMatchStats,
  };
}


