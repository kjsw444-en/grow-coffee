import assert from 'node:assert/strict'
import { initialGameState } from '../constants.js'
import { applyMinigameReward, getMinigameRewardCups } from '../minigameReward.js'

function test(name, fn) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`fail - ${name}`)
    throw error
  }
}

test('무료 슬롯 — mission1 클리어 보상 +1', () => {
  const result = applyMinigameReward(initialGameState, 'mission1', 'free')

  assert.equal(result.ok, true)
  assert.equal(result.rewardCups, 1)
  assert.equal(result.state.totalCoffees, 1)
  assert.equal(result.state.minigameRewardFreeMask & 1, 1)
  assert.equal(result.state.minigameRewardAdMask, 0)
})

test('무료 슬롯 — mission4 클리어 보상 +3', () => {
  const result = applyMinigameReward(initialGameState, 'mission4', 'free')

  assert.equal(result.ok, true)
  assert.equal(result.rewardCups, getMinigameRewardCups('mission4'))
  assert.equal(result.state.totalCoffees, 3)
})

test('광고 슬롯 — 같은 미션 추가 보상', () => {
  const first = applyMinigameReward(initialGameState, 'mission2', 'free')
  assert.equal(first.ok, true)

  const second = applyMinigameReward(first.state, 'mission2', 'ad')
  assert.equal(second.ok, true)
  assert.equal(second.rewardCups, 1)
  assert.equal(second.state.totalCoffees, 2)
  assert.equal(second.state.minigameRewardAdMask & (1 << 1), 1 << 1)
})

test('무료 슬롯 — memoryMission4 클리어 보상 +3', () => {
  const result = applyMinigameReward(initialGameState, 'memoryMission4', 'free')

  assert.equal(result.ok, true)
  assert.equal(result.rewardCups, getMinigameRewardCups('memoryMission4'))
  assert.equal(result.state.totalCoffees, 3)
})

test('무료 슬롯 — pairMission4 클리어 보상 +3', () => {
  const result = applyMinigameReward(initialGameState, 'pairMission4', 'free')

  assert.equal(result.ok, true)
  assert.equal(result.rewardCups, getMinigameRewardCups('pairMission4'))
  assert.equal(result.state.totalCoffees, 3)
})

test('같은 슬롯 중복 수령 거부', () => {
  const first = applyMinigameReward(initialGameState, 'memoryMission1', 'free')
  const second = applyMinigameReward(first.state, 'memoryMission1', 'free')

  assert.equal(second.ok, false)
  assert.equal(second.reason, 'already-claimed')
})

console.log('minigame-reward tests passed')
