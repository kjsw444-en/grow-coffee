import assert from 'node:assert/strict'
import { applyWatchAd, applyWater, applyWaterFinalizeCycle } from '../gameLogic.js'
import { initialGameState } from '../constants.js'
import { canWaterToday, needsAdForWater } from '../waterQuota.js'

function test(name, fn) {
  fn()
  console.log(`ok: ${name}`)
}

test('첫 물주기 후 25% — 광고 후 다음 물주기', () => {
  const state = { ...initialGameState, growth: 0 }
  assert.equal(canWaterToday(state), true)
  assert.equal(needsAdForWater(state), false)

  const first = applyWater(state)
  assert.equal(first.ok, true)
  assert.equal(first.state.growth, 25)
  assert.equal(first.state.watersToday, 1)
  assert.equal(canWaterToday(first.state), false)
  assert.equal(needsAdForWater(first.state), true)
})

test('0%에서 두 번째 사이클 시작 전 광고 필요', () => {
  const state = { ...initialGameState, growth: 0, watersToday: 1, waterDayKey: '2026-06-20' }
  assert.equal(canWaterToday(state), false)
  assert.equal(needsAdForWater(state), true)
  const result = applyWater(state)
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'need-ad')
})

test('75%에서 광고 후 내리기 1회 → 100%', () => {
  const state = { ...initialGameState, growth: 75, watersToday: 1, waterDayKey: '2026-06-20' }
  assert.equal(applyWater(state).ok, false)

  const ad = applyWatchAd(state)
  assert.equal(ad.ok, true)

  const result = applyWater(ad.state)
  assert.equal(result.ok, true)
  assert.equal(result.state.growth, 100)
  assert.equal(result.state.watersToday, 2)
})

test('광고 후 다음 사이클 물주기 — 25%씩 성장', () => {
  let state = { ...initialGameState, growth: 25, watersToday: 2, waterDayKey: '2026-06-20' }

  const ad = applyWatchAd(state)
  assert.equal(ad.ok, true)
  assert.equal(ad.state.adWaterCredits, 1)
  assert.equal(canWaterToday(ad.state), true)

  const second = applyWater(ad.state)
  assert.equal(second.ok, true)
  assert.equal(second.state.growth, 50)
  assert.equal(second.state.watersToday, 3)
  assert.equal(second.state.adWaterCredits, 0)
})

test('물주기 전에는 광고 보상 불가', () => {
  const state = { ...initialGameState, growth: 0 }
  const ad = applyWatchAd(state)
  assert.equal(ad.ok, false)
  assert.equal(ad.reason, 'not-needed')
})

test('하이브리드 — 서버 quota 0·클라이언트 watersToday 1 → 광고 보상', () => {
  const server = { ...initialGameState, growth: 0, watersToday: 0, waterDayKey: '2026-07-01' }
  assert.equal(needsAdForWater(server), false)

  const ad = applyWatchAd(server, { clientWatersToday: 1 })
  assert.equal(ad.ok, true)
  assert.equal(ad.state.watersToday, 1)
  assert.equal(ad.state.adWaterCredits, 1)
  assert.equal(ad.state.growth, 0)
})

test('하이브리드 — clientWatersToday 미전달 시 서버 quota 0이면 거절', () => {
  const server = { ...initialGameState, growth: 0, watersToday: 0 }
  const ad = applyWatchAd(server)
  assert.equal(ad.ok, false)
  assert.equal(ad.reason, 'not-needed')
})

test('하이브리드 — 2·3회째 광고 (로컬 크레딧 소모 반영)', () => {
  let server = { ...initialGameState, growth: 0, watersToday: 0, waterDayKey: '2026-07-01' }
  const ad1 = applyWatchAd(server, { clientWatersToday: 1 })
  assert.equal(ad1.ok, true)
  assert.equal(ad1.state.adWaterCredits, 1)

  const ad2 = applyWatchAd(ad1.state, { clientWatersToday: 2 })
  assert.equal(ad2.ok, true)
  assert.equal(ad2.state.watersToday, 2)
  assert.equal(ad2.state.adWaterCredits, 1)

  const ad3 = applyWatchAd(ad2.state, { clientWatersToday: 3 })
  assert.equal(ad3.ok, true)
  assert.equal(ad3.state.watersToday, 3)
  assert.equal(ad3.state.adWaterCredits, 1)
})

test('하이브리드 — 75% 커피 내리기 finalize (clientWatersToday=3)', () => {
  let server = { ...initialGameState, growth: 0, totalWaters: 4, watersToday: 0, waterDayKey: '2026-07-01' }
  server = applyWatchAd(server, { clientWatersToday: 1 }).state
  server = applyWatchAd(server, { clientWatersToday: 2 }).state
  server = applyWatchAd(server, { clientWatersToday: 3 }).state

  const fin = applyWaterFinalizeCycle(server, 3, { clientWatersToday: 3 })
  assert.equal(fin.ok, true)
  assert.equal(fin.state.growth, 100)
  assert.equal(fin.state.watersToday, 4)
})

test('dayKey 없어도 watersToday 유지 — 0%에서 광고 슬롯', () => {
  const state = { ...initialGameState, growth: 0, watersToday: 2, waterDayKey: '' }
  assert.equal(needsAdForWater(state), true)
  assert.equal(canWaterToday(state), false)
})

test('날짜가 바뀌어도 광고 대기 상태 유지 — 일일 리셋 없음', () => {
  const state = {
    ...initialGameState,
    growth: 0,
    watersToday: 2,
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
