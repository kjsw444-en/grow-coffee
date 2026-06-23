import assert from 'node:assert/strict'
import { applyWatchAd, applyWater } from '../gameLogic.js'
import { initialGameState } from '../constants.js'
import { canWaterToday, needsAdForWater } from '../waterQuota.js'

function test(name, fn) {
  fn()
  console.log(`ok: ${name}`)
}

test('첫 물주기·내리기 후 광고 필요', () => {
  const state = { ...initialGameState, growth: 0 }
  assert.equal(canWaterToday(state), true)
  assert.equal(needsAdForWater(state), false)

  const first = applyWater(state)
  assert.equal(first.ok, true)
  assert.equal(first.state.watersToday, 1)
  assert.equal(canWaterToday(first.state), false)
  assert.equal(needsAdForWater(first.state), true)
})

test('1회 사용 후 물주기는 need-ad', () => {
  const state = { ...initialGameState, growth: 25, watersToday: 1, waterDayKey: '2026-06-20' }
  const result = applyWater(state)
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'need-ad')
})

test('광고 후에만 추가 물주기 가능', () => {
  let state = { ...initialGameState, growth: 25, watersToday: 1, waterDayKey: '2026-06-20' }

  const ad = applyWatchAd(state)
  assert.equal(ad.ok, true)
  assert.equal(ad.state.adWaterCredits, 1)
  assert.equal(canWaterToday(ad.state), true)

  const second = applyWater(ad.state)
  assert.equal(second.ok, true)
  assert.equal(second.state.watersToday, 2)
  assert.equal(second.state.adWaterCredits, 0)
  assert.equal(needsAdForWater(second.state), true)
})

test('물주기 전에는 광고 보상 불가', () => {
  const state = { ...initialGameState, growth: 0 }
  const ad = applyWatchAd(state)
  assert.equal(ad.ok, false)
  assert.equal(ad.reason, 'not-needed')
})

test('dayKey 없어도 watersToday 유지 — 광고 슬롯 유지', () => {
  const state = { ...initialGameState, growth: 25, watersToday: 1, waterDayKey: '' }
  assert.equal(needsAdForWater(state), true)
  assert.equal(canWaterToday(state), false)
})

test('날짜가 바뀌어도 광고 대기 상태 유지 — 일일 리셋 없음', () => {
  const state = {
    ...initialGameState,
    growth: 25,
    watersToday: 1,
    adWaterCredits: 0,
    waterDayKey: '2026-06-19',
  }
  assert.equal(needsAdForWater(state), true)
  assert.equal(canWaterToday(state), false)

  const blocked = applyWater(state)
  assert.equal(blocked.ok, false)
  assert.equal(blocked.reason, 'need-ad')
})

console.log('water-quota tests passed')
