import { getTodayKey, type DailyMissions } from './dailyGameStorage';

export type MissionKey = Exclude<keyof DailyMissions, 'date'>;

export type MinigameRewardSlot = 'free' | 'ad';

export type MissionPlayQuota = {
  freeUsed: boolean;
  adBonusUsed: boolean;
  freeRewardClaimed?: boolean;
  adRewardClaimed?: boolean;
};

export type DailyPlayQuotas = {
  date: string;
  missions: Partial<Record<MissionKey, MissionPlayQuota>>;
};

export type MissionPlayStatus =
  | { state: 'free_available' }
  | { state: 'ad_required' }
  | { state: 'exhausted' };

const EMPTY_QUOTA: MissionPlayQuota = {
  freeUsed: false,
  adBonusUsed: false,
  freeRewardClaimed: false,
  adRewardClaimed: false,
};

export function getFreshPlayQuotas(quotas?: Partial<DailyPlayQuotas> | null): DailyPlayQuotas {
  const today = getTodayKey();
  if (quotas?.date === today) {
    return { date: today, missions: quotas.missions ?? {} };
  }
  return { date: today, missions: {} };
}

export function getMissionQuota(quotas: DailyPlayQuotas, missionKey: MissionKey): MissionPlayQuota {
  const raw = quotas.missions[missionKey] ?? EMPTY_QUOTA;
  return {
    freeUsed: Boolean(raw.freeUsed),
    adBonusUsed: Boolean(raw.adBonusUsed),
    freeRewardClaimed: Boolean(raw.freeRewardClaimed),
    adRewardClaimed: Boolean(raw.adRewardClaimed),
  };
}

export function getMissionPlayStatus(quotas: DailyPlayQuotas, missionKey: MissionKey): MissionPlayStatus {
  const quota = getMissionQuota(quotas, missionKey);
  if (!quota.freeUsed) return { state: 'free_available' };
  if (!quota.adBonusUsed) return { state: 'ad_required' };
  return { state: 'exhausted' };
}

export function getAttemptRewardSlot(status: MissionPlayStatus): MinigameRewardSlot {
  return status.state === 'free_available' ? 'free' : 'ad';
}

export function canClaimMissionReward(
  quotas: DailyPlayQuotas,
  missionKey: MissionKey,
  slot: MinigameRewardSlot,
) {
  const quota = getMissionQuota(quotas, missionKey);
  return slot === 'ad' ? !quota.adRewardClaimed : !quota.freeRewardClaimed;
}

export function consumeMissionAttempt(
  quotas: DailyPlayQuotas,
  missionKey: MissionKey,
  slot: 'free' | 'ad',
): DailyPlayQuotas {
  const current = getMissionQuota(quotas, missionKey);
  const nextQuota: MissionPlayQuota =
    slot === 'free'
      ? { ...current, freeUsed: true }
      : { ...current, freeUsed: true, adBonusUsed: true };

  return {
    ...quotas,
    missions: { ...quotas.missions, [missionKey]: nextQuota },
  };
}

export function markMissionRewardClaimed(
  quotas: DailyPlayQuotas,
  missionKey: MissionKey,
  slot: MinigameRewardSlot,
): DailyPlayQuotas {
  const current = getMissionQuota(quotas, missionKey);
  const nextQuota: MissionPlayQuota =
    slot === 'ad'
      ? { ...current, adRewardClaimed: true }
      : { ...current, freeRewardClaimed: true };

  return {
    ...quotas,
    missions: { ...quotas.missions, [missionKey]: nextQuota },
  };
}

export function getMissionPlayLabel(status: MissionPlayStatus) {
  if (status.state === 'free_available') return '오늘 1회';
  if (status.state === 'ad_required') return '한번 더';
  return '오늘 종료';
}

export function isMissionPlayExhausted(status: MissionPlayStatus) {
  return status.state === 'exhausted';
}

export function hasMissionAttemptedToday(quotas: DailyPlayQuotas, missionKey: MissionKey) {
  const quota = getMissionQuota(quotas, missionKey);
  return quota.freeUsed || quota.adBonusUsed;
}

export function isMissionRowComplete(
  daily: { [key: string]: number | string },
  quotas: DailyPlayQuotas,
  missionKey: MissionKey,
) {
  return Number(daily[missionKey] ?? 0) >= 1 || hasMissionAttemptedToday(quotas, missionKey);
}

export function isMissionCompleteFromStatus(
  daily: { [key: string]: number | string },
  missionKey: MissionKey,
  playStatus: MissionPlayStatus,
) {
  return Number(daily[missionKey] ?? 0) >= 1 || playStatus.state !== 'free_available';
}

export function countMissionsCompleteToday(
  daily: { [key: string]: number | string },
  quotas: DailyPlayQuotas,
  missionKeys: MissionKey[],
) {
  return missionKeys.filter((key) => isMissionRowComplete(daily, quotas, key)).length;
}

export function countMissionsCompleteFromStatus(
  daily: { [key: string]: number | string },
  missionKeys: MissionKey[],
  getStatus: (missionKey: MissionKey) => MissionPlayStatus,
) {
  return missionKeys.filter((key) => isMissionCompleteFromStatus(daily, key, getStatus(key))).length;
}

export const OMOK_MISSION_KEYS: MissionKey[] = ['mission1', 'mission2', 'mission3', 'mission4'];
export const MEMORY_MISSION_KEYS: MissionKey[] = [
  'memoryMission1',
  'memoryMission2',
  'memoryMission3',
  'memoryMission4',
];
export const PAIR_MISSION_KEYS: MissionKey[] = [
  'pairMission1',
  'pairMission2',
  'pairMission3',
  'pairMission4',
];
