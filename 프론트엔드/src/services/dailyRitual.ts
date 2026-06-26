import type { GameState } from '../game/types';

export type RitualMissionProgress = {
  slot: number;
  missionId: string;
  label: string;
  shortLabel: string;
  description: string;
  current: number;
  goal: number;
  done: boolean;
};

export type RitualTodayView = {
  dayKey: string;
  fortune: {
    id: string;
    revealed: boolean;
    copy: string;
    progress: number;
    goal: number;
    rewardCups: number;
    claimed: boolean;
    canClaimFortuneReward: boolean;
  };
  gift: {
    id: string;
    opened: boolean;
    label: string;
    canOpen: boolean;
  };
  missions: {
    items: RitualMissionProgress[];
    allDone: boolean;
    claimed: boolean;
    rewardCups: number;
    canClaim: boolean;
  };
  bonusRouletteSpins: number;
  fertilizerCharges: number;
  ritualComplete: boolean;
  showRouletteNudge: boolean;
};

export function readRitualBoolean(
  raw: GameState,
  camel: keyof GameState,
  snake: string,
): boolean {
  const record = raw as GameState & Record<string, unknown>;
  const value = record[camel] ?? record[snake];
  return value === true || value === 1 || value === '1';
}

export function readRitualCount(raw: GameState, camel: keyof GameState, snake: string): number {
  const record = raw as GameState & Record<string, unknown>;
  const value = record[camel] ?? record[snake];
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

export function readRitualString(raw: GameState, camel: keyof GameState, snake: string): string {
  const record = raw as GameState & Record<string, unknown>;
  return String(record[camel] ?? record[snake] ?? '');
}

export function isRitualFortunePending(state: GameState): boolean {
  return !readRitualBoolean(state, 'ritualFortuneRevealed', 'ritual_fortune_revealed');
}

export function isRitualGiftPending(state: GameState): boolean {
  return (
    readRitualBoolean(state, 'ritualFortuneRevealed', 'ritual_fortune_revealed') &&
    !readRitualBoolean(state, 'ritualGiftOpened', 'ritual_gift_opened')
  );
}

export function isRitualComplete(state: GameState): boolean {
  return (
    readRitualBoolean(state, 'ritualFortuneRevealed', 'ritual_fortune_revealed') &&
    readRitualBoolean(state, 'ritualGiftOpened', 'ritual_gift_opened')
  );
}

export function buildLocalMissionPreview(state: GameState): RitualMissionProgress[] {
  const harvestCount = readRitualCount(state, 'ritualMissionHarvestCount', 'ritual_mission_harvest_count');
  const harvestDone =
    readRitualBoolean(state, 'ritualMission1Done', 'ritual_mission_1_done') || harvestCount >= 2;
  const minigameDone =
    readRitualBoolean(state, 'ritualMission2Done', 'ritual_mission_2_done') ||
    readRitualBoolean(state, 'ritualMissionMinigameDone', 'ritual_mission_minigame_done');
  const rouletteDone =
    readRitualBoolean(state, 'ritualMission3Done', 'ritual_mission_3_done') ||
    readRitualBoolean(state, 'ritualMissionRouletteDone', 'ritual_mission_roulette_done');

  return [
    {
      slot: 1,
      missionId: 'M_HARVEST_2',
      label: '커피 수확 2번',
      shortLabel: '수확 2번',
      description: '오늘 커피를 2번 수확하세요.',
      current: Math.min(2, harvestCount),
      goal: 2,
      done: harvestDone,
    },
    {
      slot: 2,
      missionId: 'M_MINIGAME_ANY',
      label: '미니게임 1번',
      shortLabel: '미니게임',
      description: '미니게임을 1번 플레이하세요.',
      current: minigameDone ? 1 : 0,
      goal: 1,
      done: minigameDone,
    },
    {
      slot: 3,
      missionId: 'M_ROULETTE',
      label: '룰렛 1번',
      shortLabel: '룰렛',
      description: '오늘의 룰렛을 1번 돌리세요.',
      current: rouletteDone ? 1 : 0,
      goal: 1,
      done: rouletteDone,
    },
  ];
}

export function allLocalMissionsDone(state: GameState): boolean {
  return buildLocalMissionPreview(state).every((item) => item.done);
}

export function canClaimLocalMissionReward(state: GameState): boolean {
  return allLocalMissionsDone(state) && !readRitualBoolean(state, 'ritualMissionClaimed', 'ritual_mission_claimed');
}

export const RITUAL_GIFT_TEST_OPTIONS = [
  { id: 'GIFT_COFFEE_2', label: '커피 2잔' },
  { id: 'GIFT_PASSIVE_147', label: '방치 +47%' },
  { id: 'GIFT_ROULETTE', label: '룰렛 +1' },
  { id: 'GIFT_SKIP_SEED', label: '새싹 시작' },
] as const;

const RITUAL_GIFT_LABELS: Record<string, string> = {
  GIFT_COFFEE_2: '내린 커피 2잔',
  GIFT_PASSIVE_147: '방치 +47%',
  GIFT_ROULETTE: '룰렛 +1회',
  GIFT_SKIP_SEED: '새싹부터 시작',
};

const RITUAL_GIFT_DESCRIPTIONS: Record<string, string> = {
  GIFT_COFFEE_2: '고양이 선물로 내린 커피 2잔을 바로 받았어요.',
  GIFT_PASSIVE_147: '오늘 하루 동안 방치 커피 충전 속도가 47% 빨라져요.',
  GIFT_ROULETTE: '오늘 룰렛을 한 번 더 돌릴 수 있어요.',
  GIFT_SKIP_SEED:
    '오늘 하루 동안 씨앗 단계(0~24%)를 건너뛰고 새싹(25%)부터 자라요. 커피를 마신 뒤에도 새싹부터 다시 시작해요.',
};

export const RITUAL_SKIP_SEED_MIN_GROWTH = 25;

export function hasRitualSkipSeedGift(state: GameState): boolean {
  return (
    readRitualBoolean(state, 'ritualGiftOpened', 'ritual_gift_opened') &&
    readRitualString(state, 'ritualGiftId', 'ritual_gift_id') === 'GIFT_SKIP_SEED'
  );
}

export function getRitualEffectiveGrowth(state: GameState, growth: number): number {
  const value = Math.min(100, Math.max(0, growth));
  if (!hasRitualSkipSeedGift(state)) {
    return value;
  }

  return Math.max(value, RITUAL_SKIP_SEED_MIN_GROWTH);
}

export function getRitualGiftLabel(giftId: string): string | null {
  const normalized = String(giftId ?? '').trim();
  if (!normalized) return null;
  return RITUAL_GIFT_LABELS[normalized] ?? null;
}

export function getRitualGiftDescription(giftId: string): string | null {
  const normalized = String(giftId ?? '').trim();
  if (!normalized) return null;
  return RITUAL_GIFT_DESCRIPTIONS[normalized] ?? null;
}

export function getOpenedRitualGiftDescription(state: GameState): string | null {
  if (!readRitualBoolean(state, 'ritualGiftOpened', 'ritual_gift_opened')) {
    return null;
  }
  return getRitualGiftDescription(readRitualString(state, 'ritualGiftId', 'ritual_gift_id'));
}

export function getOpenedRitualGiftLabel(state: GameState): string | null {
  if (!readRitualBoolean(state, 'ritualGiftOpened', 'ritual_gift_opened')) {
    return null;
  }
  return getRitualGiftLabel(readRitualString(state, 'ritualGiftId', 'ritual_gift_id'));
}
