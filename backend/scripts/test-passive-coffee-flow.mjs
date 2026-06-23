/**
 * 방치 커피 알고리즘 (1~9) 통합 검증
 * 1. 게이지 0→100%  2. ~20분 충전  3. 받기 버튼·100%
 * 4~5. 받기 → 0/2→1/2, 게이지 0%  6. 2번째 100% 반복
 * 7. 2/2 → 재활성  8. 재활성 후 1~6 반복  9. 재활성 하루 1회
 */
import assert from 'node:assert/strict'
import {
  applyClaimPassiveCoffee,
  applyReactivatePassiveCoffee,
} from '../gameLogic.js'
import { initialGameState } from '../constants.js'
import { getPassiveDayKey, roundGrowth, settlePassiveGrowth } from '../passiveGrowth.js'

function passiveUi(state) {
  const maxCups = 2
  const claimed = Math.max(0, Math.floor(state.passiveCoffeesClaimed ?? 0))
  const daily = roundGrowth(state.dailyPassiveGrowth ?? 0)
  const unclaimed = roundGrowth(Math.max(0, daily - claimed * 100))
  const canClaim = Math.floor(unclaimed / 100) >= 1 && claimed < maxCups
  const complete = claimed >= maxCups
  const reactivateKey = String(state.passiveReactivateDayKey ?? '')
  const reactivateUsedToday = reactivateKey === getPassiveDayKey()
  const canReactivate = complete && !reactivateUsedToday
  const gauge = complete ? 100 : Math.min(100, unclaimed)
  return { claimed, daily, unclaimed, canClaim, complete, canReactivate, reactivateUsedToday, gauge }
}

function accrueMinutes(state, minutes) {
  const syncedAt = new Date(Date.now() - minutes * 60 * 1000).toISOString()
  return settlePassiveGrowth({ ...state, growthAccrualSyncedAt: syncedAt })
}

function test(name, fn) {
  fn()
  console.log(`ok: ${name}`)
}

const dayKey = getPassiveDayKey()

test('1~3 — 20분 후 100%·받기 가능', () => {
  let state = {
    ...initialGameState,
    passiveDayKey: dayKey,
    dailyPassiveGrowth: 0,
    passiveCoffeesClaimed: 0,
    growthAccrualSyncedAt: new Date().toISOString(),
  }
  state = accrueMinutes(state, 21)
  const ui = passiveUi(state)
  assert.ok(ui.daily >= 100, `expected daily>=100, got ${ui.daily}`)
  assert.equal(ui.canClaim, true)
  assert.equal(ui.gauge, 100)
  assert.equal(ui.claimed, 0)
})

test('4~5 — 1잔 받기: 1/2·게이지 0%·totalCoffees +1', () => {
  let state = accrueMinutes(
    {
      ...initialGameState,
      totalCoffees: 5,
      passiveDayKey: dayKey,
      dailyPassiveGrowth: 0,
      passiveCoffeesClaimed: 0,
    },
    21,
  )
  const claim = applyClaimPassiveCoffee(state)
  assert.equal(claim.ok, true, claim.reason)
  state = claim.state
  assert.equal(state.passiveCoffeesClaimed, 1)
  assert.equal(state.totalCoffees, 6)
  const ui = passiveUi(state)
  assert.equal(ui.claimed, 1)
  assert.equal(ui.canClaim, false)
  assert.ok(ui.gauge < 100, `gauge should reset, got ${ui.gauge}`)
  assert.ok(ui.unclaimed < 100, `unclaimed should be <100, got ${ui.unclaimed}`)
})

test('6 — 2번째 100% 후 다시 받기 → 2/2', () => {
  let state = accrueMinutes(
    {
      ...initialGameState,
      passiveDayKey: dayKey,
      dailyPassiveGrowth: 0,
      passiveCoffeesClaimed: 0,
    },
    21,
  )
  state = applyClaimPassiveCoffee(state).state
  state = accrueMinutes(state, 42)
  assert.equal(passiveUi(state).canClaim, true, `2nd cup should be ready, ui=${JSON.stringify(passiveUi(state))}`)
  state = applyClaimPassiveCoffee(state).state
  const ui = passiveUi(state)
  assert.equal(ui.claimed, 2)
  assert.equal(ui.complete, true)
  assert.equal(ui.canClaim, false)
  assert.equal(ui.canReactivate, true)
})

test('7~8 — 2/2에서 재활성 → 0/2·게이지 0·다시 2잔 사이클', () => {
  let state = {
    ...initialGameState,
    passiveDayKey: dayKey,
    dailyPassiveGrowth: 200,
    passiveCoffeesClaimed: 2,
    passiveReactivateDayKey: '',
  }
  const reactivate = applyReactivatePassiveCoffee(state)
  assert.equal(reactivate.ok, true, reactivate.reason)
  state = reactivate.state
  assert.equal(state.passiveCoffeesClaimed, 0)
  assert.equal(state.dailyPassiveGrowth, 0)
  assert.equal(state.passiveReactivateDayKey, dayKey)

  state = accrueMinutes(state, 21)
  assert.equal(passiveUi(state).canClaim, true)
  state = applyClaimPassiveCoffee(state).state
  assert.equal(state.passiveCoffeesClaimed, 1)
  state = accrueMinutes(state, 42)
  assert.equal(passiveUi(state).canClaim, true)
  state = applyClaimPassiveCoffee(state).state
  assert.equal(state.passiveCoffeesClaimed, 2)
  assert.equal(passiveUi(state).complete, true)
})

test('9 — 재활성은 하루 1회만', () => {
  let state = {
    ...initialGameState,
    passiveDayKey: dayKey,
    dailyPassiveGrowth: 200,
    passiveCoffeesClaimed: 2,
    passiveReactivateDayKey: dayKey,
  }
  const again = applyReactivatePassiveCoffee(state)
  assert.equal(again.ok, false)
  assert.equal(again.reason, 'already-reactivated')
  assert.equal(passiveUi(state).reactivateUsedToday, true)
  assert.equal(passiveUi(state).canReactivate, false)
})

test('200% 누적 후 1잔 받기 — 게이지 0% 유지', () => {
  const state = {
    ...initialGameState,
    passiveDayKey: dayKey,
    dailyPassiveGrowth: 200,
    passiveCoffeesClaimed: 0,
  }
  const claim = applyClaimPassiveCoffee(state)
  assert.equal(claim.ok, true)
  const ui = passiveUi(claim.state)
  assert.equal(ui.claimed, 1)
  assert.equal(ui.unclaimed, 0)
  assert.equal(ui.gauge, 0)
})

console.log('passive-coffee-flow tests passed')
