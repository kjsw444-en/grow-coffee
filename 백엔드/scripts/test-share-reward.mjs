import assert from 'node:assert/strict'
import { initialGameState, SHARE_REWARD_COFFEE_AMOUNT } from '../constants.js'
import { applyShareReward } from '../gameLogic.js'

function test(name, fn) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`fail - ${name}`)
    throw error
  }
}

test('공유 리워드 — totalCoffees +25', () => {
  const result = applyShareReward(initialGameState)

  assert.equal(result.ok, true)
  assert.equal(result.rewardAmount, SHARE_REWARD_COFFEE_AMOUNT)
  assert.equal(result.state.totalCoffees, SHARE_REWARD_COFFEE_AMOUNT)
})

test('공유 리워드 — 하루 1회', () => {
  const first = applyShareReward(initialGameState)
  assert.equal(first.ok, true)

  const second = applyShareReward(first.state)
  assert.equal(second.ok, false)
  assert.equal(second.reason, 'already-claimed')
})

console.log('share-reward tests passed')
