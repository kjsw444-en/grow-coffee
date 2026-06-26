import { getTodayKey } from './attendance';

/** 룰렛 칸 순서 (시계 방향, 12시부터) */
export const DAILY_LOGIN_ROULETTE_SEGMENTS = [1, 5, 8, 10, 15, 20, 50] as const;

export type DailyLoginRouletteCups = (typeof DAILY_LOGIN_ROULETTE_SEGMENTS)[number];

const SEGMENT_COUNT = DAILY_LOGIN_ROULETTE_SEGMENTS.length;
const SEGMENT_ANGLE = 360 / SEGMENT_COUNT;
/** 이미지 룰렛: 1잔 칸 중심이 12시 포인터에 맞도록 보정 */
const WHEEL_IMAGE_OFFSET_DEG = -SEGMENT_ANGLE / 2;

/** 당첨 가중치 — 8잔은 표시만(확률표에 없음), 추첨 제외. 실제 추첨은 백엔드 전용 */
export const DAILY_LOGIN_ROULETTE_WEIGHTS: ReadonlyArray<{ cups: DailyLoginRouletteCups; weight: number }> = [
  { cups: 1, weight: 60 },
  { cups: 5, weight: 20 },
  { cups: 10, weight: 10 },
  { cups: 15, weight: 5 },
  { cups: 20, weight: 3 },
  { cups: 50, weight: 2 },
];

export function getDailyLoginRouletteSegmentAngleStep() {
  return SEGMENT_ANGLE;
}

/** 12시 기준 시계방향 각도 — 라벨·당첨 정렬 공통 */
export function getDailyLoginRouletteSegmentCenterDeg(segmentIndex: number) {
  return segmentIndex * SEGMENT_ANGLE + SEGMENT_ANGLE / 2 + WHEEL_IMAGE_OFFSET_DEG;
}

/** DEV 애니메이션 미리보기 전용 — 실제 당첨은 백엔드에서 결정 */
export function pickDailyLoginRouletteCups(random = Math.random()) {
  const pool = DAILY_LOGIN_ROULETTE_WEIGHTS.filter((item) => item.weight > 0);
  const total = pool.reduce((sum, item) => sum + item.weight, 0);
  let roll = random * total;

  for (const item of pool) {
    roll -= item.weight;
    if (roll <= 0) {
      return item.cups;
    }
  }

  return pool[pool.length - 1]?.cups ?? 1;
}

export function getDailyLoginRouletteSegmentIndex(cups: number) {
  const index = DAILY_LOGIN_ROULETTE_SEGMENTS.indexOf(cups as DailyLoginRouletteCups);
  return index >= 0 ? index : 0;
}

/** 고정 판 + 회전 화살표 — segmentIndex 중앙을 가리키도록 이어 돌릴 각도 */
export function getNextDailyLoginRouletteRotation(
  segmentIndex: number,
  currentRotationDeg: number,
  extraTurns = 6,
) {
  const segmentCenter = getDailyLoginRouletteSegmentCenterDeg(segmentIndex);
  const targetMod = ((segmentCenter % 360) + 360) % 360;
  const currentMod = ((currentRotationDeg % 360) + 360) % 360;
  let delta = targetMod - currentMod;
  if (delta < 0) delta += 360;
  return currentRotationDeg + extraTurns * 360 + delta;
}

/** 검증용 — 현재 화살표 각도가 가리키는 segment index */
export function getDailyLoginRouletteSegmentIndexAtPointer(pointerRotationDeg: number) {
  const adjusted = ((pointerRotationDeg % 360) + 360) % 360;
  const index = Math.round(adjusted / SEGMENT_ANGLE);
  return ((index % SEGMENT_COUNT) + SEGMENT_COUNT) % SEGMENT_COUNT;
}

export function canClaimDailyLoginRouletteToday(
  dailyLoginRouletteDayKey: string | undefined,
  dateKey = getTodayKey(),
) {
  return String(dailyLoginRouletteDayKey ?? '') !== dateKey;
}

export function canSpinDailyLoginRouletteToday(
  state: {
    dailyLoginRouletteDayKey?: string;
    ritualBonusRouletteSpins?: number;
  },
  dateKey = getTodayKey(),
) {
  if (canClaimDailyLoginRouletteToday(state.dailyLoginRouletteDayKey, dateKey)) {
    return true;
  }

  return Math.max(0, Number(state.ritualBonusRouletteSpins ?? 0)) > 0;
}

/** 고양이 선물 등으로 받은 추가 룰렛 — 오늘 1회 룰렛을 이미 돌린 뒤 보너스만 남은 상태 */
export function hasPendingBonusRouletteSpin(
  state: {
    dailyLoginRouletteDayKey?: string;
    ritualBonusRouletteSpins?: number;
  },
  dateKey = getTodayKey(),
) {
  return (
    String(state.dailyLoginRouletteDayKey ?? '') === dateKey &&
    Math.max(0, Number(state.ritualBonusRouletteSpins ?? 0)) > 0
  );
}

export function canRespinDailyLoginRouletteToday(
  dailyLoginRouletteDayKey: string | undefined,
  dailyLoginRouletteRespinDayKey: string | undefined,
  dateKey = getTodayKey(),
) {
  return (
    String(dailyLoginRouletteDayKey ?? '') === dateKey &&
    String(dailyLoginRouletteRespinDayKey ?? '') !== dateKey
  );
}

export function formatDailyLoginRouletteReward(cups: number) {
  return `내린 커피 ${cups.toLocaleString('ko-KR')}잔`;
}

export const DAILY_LOGIN_ROULETTE_BIG_WIN_MIN_CUPS = 5;

export function isDailyLoginRouletteBigWin(cups: number) {
  return cups >= DAILY_LOGIN_ROULETTE_BIG_WIN_MIN_CUPS;
}
