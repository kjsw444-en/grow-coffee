import { getTodayKey } from './waterQuota.js'

/** 하루 목표: 커피나무 100% 수확(내리기) 횟수 */
export const ATTENDANCE_DAILY_GOAL = 3
export const ATTENDANCE_DAILY_REWARD = 5
export const ATTENDANCE_STREAK_TARGET = 7
export const ATTENDANCE_STREAK_BONUS = 10

function readCount(raw, camel, snake) {
  const value = raw?.[camel] ?? raw?.[snake]
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0
}

function readBool(raw, camel, snake) {
  const value = raw?.[camel] ?? raw?.[snake]
  return value === true || value === 1 || value === '1' || value === 'true'
}

export function getYesterdayKey(date = new Date()) {
  const kst = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  kst.setDate(kst.getDate() - 1)
  return kst.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

function readAttendanceFields(raw) {
  return {
    attendanceDayKey: String(raw?.attendanceDayKey ?? raw?.attendance_day_key ?? ''),
    attendanceCupsToday: readCount(raw, 'attendanceCupsToday', 'attendance_cups_today'),
    attendanceStreak: readCount(raw, 'attendanceStreak', 'attendance_streak'),
    attendanceLastGoalDayKey: String(
      raw?.attendanceLastGoalDayKey ?? raw?.attendance_last_goal_day_key ?? '',
    ),
    attendanceDailyClaimDayKey: String(
      raw?.attendanceDailyClaimDayKey ?? raw?.attendance_daily_claim_day_key ?? '',
    ),
    attendanceStreakBonusPending: readBool(
      raw,
      'attendanceStreakBonusPending',
      'attendance_streak_bonus_pending',
    ),
  }
}

/** 일자 변경 시 출석 진행·연속일 보정 */
export function normalizeAttendance(raw, today = getTodayKey()) {
  const current = readAttendanceFields(raw)
  const { attendanceDayKey: dayKey } = current
  let {
    attendanceCupsToday: harvestsToday,
    attendanceStreak: streak,
    attendanceLastGoalDayKey: lastGoalDayKey,
    attendanceDailyClaimDayKey: dailyClaimDayKey,
    attendanceStreakBonusPending: streakBonusPending,
  } = current

  if (!dayKey) {
    return {
      attendanceDayKey: today,
      attendanceCupsToday: 0,
      attendanceStreak: streak,
      attendanceLastGoalDayKey: lastGoalDayKey,
      attendanceDailyClaimDayKey: dailyClaimDayKey,
      attendanceStreakBonusPending: streakBonusPending,
    }
  }

  if (dayKey === today) {
    return {
      attendanceDayKey: today,
      attendanceCupsToday: harvestsToday,
      attendanceStreak: streak,
      attendanceLastGoalDayKey: lastGoalDayKey,
      attendanceDailyClaimDayKey: dailyClaimDayKey,
      attendanceStreakBonusPending: streakBonusPending,
    }
  }

  const yesterday = getYesterdayKey()
  if (dayKey === yesterday) {
    if (harvestsToday < ATTENDANCE_DAILY_GOAL) {
      streak = 0
      streakBonusPending = false
    }
  } else {
    streak = 0
    streakBonusPending = false
  }

  return {
    attendanceDayKey: today,
    attendanceCupsToday: 0,
    attendanceStreak: streak,
    attendanceLastGoalDayKey: lastGoalDayKey,
    attendanceDailyClaimDayKey: dailyClaimDayKey,
    attendanceStreakBonusPending: streakBonusPending,
  }
}

export function isAttendanceGoalMetToday(att) {
  return (
    att.attendanceCupsToday >= ATTENDANCE_DAILY_GOAL || att.attendanceLastGoalDayKey === getTodayKey()
  )
}

/** 커피나무 100% 수확(내리기) 1회당 출석 진행 +1 — 보상은 버튼으로 수동 수령 */
export function applyAttendanceFromTreeHarvest(state) {
  const today = getTodayKey()
  const base = normalizeAttendance(state, today)
  const harvestsToday = base.attendanceCupsToday + 1
  let streak = base.attendanceStreak
  let lastGoalDayKey = base.attendanceLastGoalDayKey
  let streakBonusPending = base.attendanceStreakBonusPending
  let goalJustMet = false

  const nowGoalMet = harvestsToday >= ATTENDANCE_DAILY_GOAL
  if (nowGoalMet && lastGoalDayKey !== today) {
    goalJustMet = true
    lastGoalDayKey = today
    streak += 1

    if (streak >= ATTENDANCE_STREAK_TARGET) {
      streakBonusPending = true
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
  }
}

export function applyClaimAttendanceDailyReward(state) {
  const att = normalizeAttendance(state)
  const today = getTodayKey()

  if (!isAttendanceGoalMetToday(att)) {
    return { ok: false, reason: 'goal-not-met', state }
  }

  if (att.attendanceDailyClaimDayKey === today) {
    return { ok: false, reason: 'already-claimed', state }
  }

  return {
    ok: true,
    state: {
      ...state,
      ...att,
      totalCoffees: Number(state.totalCoffees ?? 0) + ATTENDANCE_DAILY_REWARD,
      attendanceDailyClaimDayKey: today,
    },
    rewardCups: ATTENDANCE_DAILY_REWARD,
  }
}

export function applyClaimAttendanceStreakBonus(state) {
  const att = normalizeAttendance(state)

  if (!att.attendanceStreakBonusPending) {
    return { ok: false, reason: 'not-available', state }
  }

  return {
    ok: true,
    state: {
      ...state,
      ...att,
      totalCoffees: Number(state.totalCoffees ?? 0) + ATTENDANCE_STREAK_BONUS,
      attendanceStreak: 0,
      attendanceStreakBonusPending: false,
    },
    rewardCups: ATTENDANCE_STREAK_BONUS,
  }
}

export function getAttendanceUiStats(raw) {
  const att = normalizeAttendance(raw)
  const today = getTodayKey()
  const goalMetToday = isAttendanceGoalMetToday(att)
  const dailyClaimedToday = att.attendanceDailyClaimDayKey === today
  const progressHarvests = Math.min(att.attendanceCupsToday, ATTENDANCE_DAILY_GOAL)

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
  }
}
