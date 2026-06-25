import type { GameState } from './types';

/** 하루 목표: 커피나무 100% 수확(내리기) 횟수 */
export const ATTENDANCE_DAILY_GOAL = 3;
export const ATTENDANCE_DAILY_REWARD = 5;
export const ATTENDANCE_STREAK_TARGET = 7;
export const ATTENDANCE_STREAK_BONUS = 10;

function readCount(raw: GameState, camel: keyof GameState, snake: string) {
  const record = raw as GameState & Record<string, unknown>;
  const value = record[camel] ?? record[snake];
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function readBool(raw: GameState, camel: keyof GameState, snake: string) {
  const record = raw as GameState & Record<string, unknown>;
  const value = record[camel] ?? record[snake];
  return value === true || value === 1 || value === '1' || value === 'true';
}

export function getTodayKey(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

export function getYesterdayKey(date = new Date()) {
  const kst = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  kst.setDate(kst.getDate() - 1);
  return kst.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

function readAttendanceFields(raw: GameState) {
  return {
    attendanceDayKey: String(raw.attendanceDayKey ?? ''),
    attendanceCupsToday: readCount(raw, 'attendanceCupsToday', 'attendance_cups_today'),
    attendanceStreak: readCount(raw, 'attendanceStreak', 'attendance_streak'),
    attendanceLastGoalDayKey: String(raw.attendanceLastGoalDayKey ?? ''),
    attendanceDailyClaimDayKey: String(
      raw.attendanceDailyClaimDayKey ??
        (raw as GameState & { attendance_daily_claim_day_key?: string }).attendance_daily_claim_day_key ??
        '',
    ),
    attendanceStreakBonusPending: readBool(
      raw,
      'attendanceStreakBonusPending',
      'attendance_streak_bonus_pending',
    ),
  };
}

export function normalizeAttendance(raw: GameState, today = getTodayKey()) {
  const current = readAttendanceFields(raw);
  const { attendanceDayKey: dayKey } = current;
  let {
    attendanceCupsToday: harvestsToday,
    attendanceStreak: streak,
    attendanceLastGoalDayKey: lastGoalDayKey,
    attendanceDailyClaimDayKey: dailyClaimDayKey,
    attendanceStreakBonusPending: streakBonusPending,
  } = current;

  if (!dayKey) {
    return {
      attendanceDayKey: today,
      attendanceCupsToday: 0,
      attendanceStreak: streak,
      attendanceLastGoalDayKey: lastGoalDayKey,
      attendanceDailyClaimDayKey: dailyClaimDayKey,
      attendanceStreakBonusPending: streakBonusPending,
    };
  }

  if (dayKey === today) {
    return {
      attendanceDayKey: today,
      attendanceCupsToday: harvestsToday,
      attendanceStreak: streak,
      attendanceLastGoalDayKey: lastGoalDayKey,
      attendanceDailyClaimDayKey: dailyClaimDayKey,
      attendanceStreakBonusPending: streakBonusPending,
    };
  }

  const yesterday = getYesterdayKey();
  if (dayKey === yesterday) {
    if (harvestsToday < ATTENDANCE_DAILY_GOAL) {
      streak = 0;
      streakBonusPending = false;
    }
  } else {
    streak = 0;
    streakBonusPending = false;
  }

  return {
    attendanceDayKey: today,
    attendanceCupsToday: 0,
    attendanceStreak: streak,
    attendanceLastGoalDayKey: lastGoalDayKey,
    attendanceDailyClaimDayKey: dailyClaimDayKey,
    attendanceStreakBonusPending: streakBonusPending,
  };
}

function isAttendanceGoalMetToday(att: ReturnType<typeof normalizeAttendance>) {
  return (
    att.attendanceCupsToday >= ATTENDANCE_DAILY_GOAL || att.attendanceLastGoalDayKey === getTodayKey()
  );
}

export type AttendanceUiStats = {
  harvestsToday: number;
  dailyGoal: number;
  goalMetToday: boolean;
  streak: number;
  streakTarget: number;
  dailyRewardCups: number;
  bonusCups: number;
  canClaimDaily: boolean;
  canClaimStreakBonus: boolean;
  dailyClaimedToday: boolean;
  progressPercent: number;
  streakPercent: number;
};

export function getAttendanceUiStats(state: GameState): AttendanceUiStats {
  const att = normalizeAttendance(state);
  const today = getTodayKey();
  const goalMetToday = isAttendanceGoalMetToday(att);
  const dailyClaimedToday = att.attendanceDailyClaimDayKey === today;
  const progressHarvests = Math.min(att.attendanceCupsToday, ATTENDANCE_DAILY_GOAL);

  return {
    harvestsToday: att.attendanceCupsToday,
    dailyGoal: ATTENDANCE_DAILY_GOAL,
    goalMetToday,
    streak: att.attendanceStreak,
    streakTarget: ATTENDANCE_STREAK_TARGET,
    dailyRewardCups: ATTENDANCE_DAILY_REWARD,
    bonusCups: ATTENDANCE_STREAK_BONUS,
    canClaimDaily: goalMetToday && !dailyClaimedToday,
    canClaimStreakBonus: att.attendanceStreakBonusPending,
    dailyClaimedToday,
    progressPercent: Math.min(100, (progressHarvests / ATTENDANCE_DAILY_GOAL) * 100),
    streakPercent: Math.min(100, (att.attendanceStreak / ATTENDANCE_STREAK_TARGET) * 100),
  };
}

/** sell-batch 등 서버 응답 병합 — 오늘 출석 진행이 되돌아가지 않게 */
export function mergeAttendanceFromServer(local: GameState, incoming: GameState) {
  const today = getTodayKey();
  const localAtt = normalizeAttendance(local, today);
  const incomingAtt = normalizeAttendance(incoming, today);

  const harvestsToday = Math.max(localAtt.attendanceCupsToday, incomingAtt.attendanceCupsToday);
  const streakBonusPending =
    localAtt.attendanceStreakBonusPending || incomingAtt.attendanceStreakBonusPending;

  let streak = localAtt.attendanceStreak;
  let lastGoalDayKey = localAtt.attendanceLastGoalDayKey;
  let dailyClaimDayKey = localAtt.attendanceDailyClaimDayKey;

  if (incomingAtt.attendanceCupsToday > localAtt.attendanceCupsToday) {
    streak = incomingAtt.attendanceStreak;
    lastGoalDayKey = incomingAtt.attendanceLastGoalDayKey;
  } else if (incomingAtt.attendanceCupsToday === localAtt.attendanceCupsToday) {
    streak = Math.max(localAtt.attendanceStreak, incomingAtt.attendanceStreak);
    lastGoalDayKey =
      localAtt.attendanceLastGoalDayKey === today || incomingAtt.attendanceLastGoalDayKey === today
        ? today
        : localAtt.attendanceLastGoalDayKey || incomingAtt.attendanceLastGoalDayKey;
  }

  if (incomingAtt.attendanceDailyClaimDayKey === today || localAtt.attendanceDailyClaimDayKey === today) {
    dailyClaimDayKey = today;
  }

  return {
    attendanceDayKey: today,
    attendanceCupsToday: harvestsToday,
    attendanceStreak: streak,
    attendanceLastGoalDayKey: lastGoalDayKey,
    attendanceDailyClaimDayKey: dailyClaimDayKey,
    attendanceStreakBonusPending: streakBonusPending,
  };
}

export function applyAttendanceFromTreeHarvest(state: GameState) {
  const today = getTodayKey();
  const base = normalizeAttendance(state, today);
  const harvestsToday = base.attendanceCupsToday + 1;
  let streak = base.attendanceStreak;
  let lastGoalDayKey = base.attendanceLastGoalDayKey;
  let streakBonusPending = base.attendanceStreakBonusPending;
  let goalJustMet = false;

  const nowGoalMet = harvestsToday >= ATTENDANCE_DAILY_GOAL;
  if (nowGoalMet && lastGoalDayKey !== today) {
    goalJustMet = true;
    lastGoalDayKey = today;
    streak += 1;

    if (streak >= ATTENDANCE_STREAK_TARGET) {
      streakBonusPending = true;
    }
  }

  return {
    attendance: {
      attendanceDayKey: today,
      attendanceCupsToday: harvestsToday,
      attendanceStreak: streak,
      attendanceLastGoalDayKey: lastGoalDayKey,
      attendanceDailyClaimDayKey: base.attendanceDailyClaimDayKey,
      attendanceStreakBonusPending: streakBonusPending,
    },
    goalJustMet,
  };
}

export function applyClaimAttendanceDailyReward(state: GameState) {
  const att = normalizeAttendance(state);
  const today = getTodayKey();

  if (!isAttendanceGoalMetToday(att)) {
    return { ok: false as const, reason: 'goal-not-met' as const, state };
  }

  if (att.attendanceDailyClaimDayKey === today) {
    return { ok: false as const, reason: 'already-claimed' as const, state };
  }

  return {
    ok: true as const,
    state: {
      ...state,
      ...att,
      totalCoffees: state.totalCoffees + ATTENDANCE_DAILY_REWARD,
      attendanceDailyClaimDayKey: today,
    },
    rewardCups: ATTENDANCE_DAILY_REWARD,
  };
}

export function applyClaimAttendanceStreakBonus(state: GameState) {
  const att = normalizeAttendance(state);

  if (!att.attendanceStreakBonusPending) {
    return { ok: false as const, reason: 'not-available' as const, state };
  }

  return {
    ok: true as const,
    state: {
      ...state,
      ...att,
      totalCoffees: state.totalCoffees + ATTENDANCE_STREAK_BONUS,
      attendanceStreak: 0,
      attendanceStreakBonusPending: false,
    },
    rewardCups: ATTENDANCE_STREAK_BONUS,
  };
}
