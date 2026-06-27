import assert from 'node:assert/strict'
import {
  applyRecommendReroll,
  buildRecommendTodayView,
  getPrimaryMenuId,
  normalizeRecommendKind,
} from '../menuRecommendations.js'
import { initialGameState } from '../constants.js'
import { getTodayKey } from '../waterQuota.js'

const USER = 'test-recommend-user'
const TODAY = getTodayKey()

function testNormalizeKind() {
  assert.equal(normalizeRecommendKind('coffee'), 'coffee')
  assert.equal(normalizeRecommendKind('dinner'), 'dinner')
  assert.equal(normalizeRecommendKind('lunch'), null)
}

function testPrimaryIsDeterministic() {
  const first = getPrimaryMenuId(USER, 'coffee', TODAY)
  const second = getPrimaryMenuId(USER, 'coffee', TODAY)
  assert.ok(first)
  assert.equal(first, second)
}

function testTodayViewAndReroll() {
  const coffeeView = buildRecommendTodayView(initialGameState, USER, 'coffee', TODAY)

  assert.equal(coffeeView.activeId, coffeeView.primaryId)
  assert.equal(coffeeView.canReroll, true)

  const reroll = applyRecommendReroll(initialGameState, USER, 'coffee', TODAY)
  assert.equal(reroll.ok, true)
  assert.notEqual(reroll.menuId, coffeeView.primaryId)

  const afterView = buildRecommendTodayView(reroll.state, USER, 'coffee', TODAY)
  assert.equal(afterView.activeId, reroll.menuId)
  assert.equal(afterView.canReroll, false)

  const again = applyRecommendReroll(reroll.state, USER, 'coffee', TODAY)
  assert.equal(again.ok, false)
  assert.equal(again.reason, 'reroll-used')
}

testNormalizeKind()
testPrimaryIsDeterministic()
testTodayViewAndReroll()

console.log('test-menu-recommendations: ok')
