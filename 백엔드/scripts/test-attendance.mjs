import assert from 'node:assert/strict'
import {
  ATTENDANCE_DAILY_GOAL,
  ATTENDANCE_DAILY_REWARD,
  ATTENDANCE_STREAK_BONUS,
  ATTENDANCE_STREAK_TARGET,
  applyAttendanceFromTreeHarvest,
  applyClaimAttendanceDailyReward,
  applyClaimAttendanceStreakBonus,
  getYesterdayKey,
  normalizeAttendance,
} from '../attendance.js'
import { initialGameState } from '../constants.js'
import { applyDrink, applySellBatch } from '../gameLogic.js'
import { getTodayKey } from '../waterQuota.js'

function test(name, fn) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`fail - ${name}`)
    throw error
  }
}

const today = getTodayKey()
const yesterday = getYesterdayKey()

test('normalize — 당일 진행 유지', () => {
  const att = normalizeAttendance({
    attendanceDayKey: today,
    attendanceCupsToday: 2,
    attendanceStreak: 2,
    attendanceLastGoalDayKey: yesterday,
    attendanceDailyClaimDayKey: '',
    attendanceStreakBonusPending: false,
  })

  assert.equal(att.attendanceDayKey, today)
  assert.equal(att.attendanceCupsToday, 2)
  assert.equal(att.attendanceStreak, 2)
})

test('normalize — 어제 목표 미달 시 연속일 0', () => {
  const att = normalizeAttendance({
    attendanceDayKey: yesterday,
    attendanceCupsToday: 1,
    attendanceStreak: 4,
    attendanceLastGoalDayKey: yesterday,
    attendanceStreakBonusPending: true,
  })

  assert.equal(att.attendanceDayKey, today)
  assert.equal(att.attendanceCupsToday, 0)
  assert.equal(att.attendanceStreak, 0)
  assert.equal(att.attendanceStreakBonusPending, false)
})

test('tree-harvest — 목표 달성 시 자동 지급 없음, streak +1', () => {
  const result = applyAttendanceFromTreeHarvest({
    attendanceDayKey: today,
    attendanceCupsToday: ATTENDANCE_DAILY_GOAL - 1,
    attendanceStreak: 1,
    attendanceLastGoalDayKey: '',
  })

  assert.equal(result.goalJustMet, true)
  assert.equal(result.attendance.attendanceStreak, 2)
  assert.equal(result.attendance.attendanceStreakBonusPending, false)
})

test('tree-harvest — 7일 연속 시 보너스 대기, streak 유지', () => {
  const result = applyAttendanceFromTreeHarvest({
    attendanceDayKey: today,
    attendanceCupsToday: ATTENDANCE_DAILY_GOAL - 1,
    attendanceStreak: ATTENDANCE_STREAK_TARGET - 1,
    attendanceLastGoalDayKey: '',
  })

  assert.equal(result.goalJustMet, true)
  assert.equal(result.attendance.attendanceStreak, ATTENDANCE_STREAK_TARGET)
  assert.equal(result.attendance.attendanceStreakBonusPending, true)
})

test('applyDrink — 수확 시 확률 보상만큼 내린 커피 추가', () => {
  const result = applyDrink(
    {
      ...initialGameState,
      growth: 100,
      totalCoffees: 4,
      attendanceDayKey: today,
      attendanceCupsToday: 0,
      attendanceStreak: 0,
      attendanceLastGoalDayKey: '',
    },
    { randomValue: 0.98 },
  )

  assert.equal(result.ok, true)
  assert.equal(result.lastEarned, 4)
  assert.equal(result.state.totalCoffees, 8)
})

test('일일 출석 보상 — 5잔 수동 수령', () => {
  const claimed = applyClaimAttendanceDailyReward({
    ...initialGameState,
    totalCoffees: 0,
    attendanceDayKey: today,
    attendanceCupsToday: ATTENDANCE_DAILY_GOAL,
    attendanceLastGoalDayKey: today,
    attendanceStreak: 1,
  })

  assert.equal(claimed.ok, true)
  assert.equal(claimed.rewardCups, ATTENDANCE_DAILY_REWARD)
  assert.equal(claimed.state.totalCoffees, ATTENDANCE_DAILY_REWARD)
  assert.equal(claimed.state.attendanceDailyClaimDayKey, today)

  const again = applyClaimAttendanceDailyReward(claimed.state)
  assert.equal(again.ok, false)
  assert.equal(again.reason, 'already-claimed')
})

test('7일 연속 보너스 — 10잔 수동 수령 후 streak 초기화', () => {
  const claimed = applyClaimAttendanceStreakBonus({
    ...initialGameState,
    totalCoffees: 0,
    attendanceDayKey: today,
    attendanceCupsToday: ATTENDANCE_DAILY_GOAL,
    attendanceStreak: ATTENDANCE_STREAK_TARGET,
    attendanceStreakBonusPending: true,
  })

  assert.equal(claimed.ok, true)
  assert.equal(claimed.rewardCups, ATTENDANCE_STREAK_BONUS)
  assert.equal(claimed.state.totalCoffees, ATTENDANCE_STREAK_BONUS)
  assert.equal(claimed.state.attendanceStreak, 0)
  assert.equal(claimed.state.attendanceStreakBonusPending, false)
})

test('7일째 — 일일 5잔 + 연속 10잔 버튼 모두 수령 가능', () => {
  let state = {
    ...initialGameState,
    totalCoffees: 0,
    attendanceDayKey: today,
    attendanceCupsToday: ATTENDANCE_DAILY_GOAL - 1,
    attendanceStreak: ATTENDANCE_STREAK_TARGET - 1,
    attendanceLastGoalDayKey: '',
    attendanceDailyClaimDayKey: '',
    attendanceStreakBonusPending: false,
  }

  const harvest = applyAttendanceFromTreeHarvest(state)
  state = { ...state, ...harvest.attendance }

  const daily = applyClaimAttendanceDailyReward(state)
  assert.equal(daily.ok, true)
  assert.equal(daily.state.totalCoffees, ATTENDANCE_DAILY_REWARD)

  const streak = applyClaimAttendanceStreakBonus(daily.state)
  assert.equal(streak.ok, true)
  assert.equal(streak.state.totalCoffees, ATTENDANCE_DAILY_REWARD + ATTENDANCE_STREAK_BONUS)
})

test('sell-batch — 출석 진행 유지', () => {
  const result = applySellBatch(
    {
      ...initialGameState,
      totalCoffees: 100,
      attendanceDayKey: today,
      attendanceCupsToday: 2,
      attendanceStreak: 1,
      attendanceLastGoalDayKey: today,
      attendanceDailyClaimDayKey: '',
      attendanceStreakBonusPending: false,
    },
    50,
  )

  assert.equal(result.ok, true)
  assert.equal(result.state.attendanceCupsToday, 2)
  assert.equal(result.state.attendanceStreak, 1)
})

console.log('attendance tests passed')
