import assert from 'node:assert/strict'
import {
  applyRecommendReroll,
  buildRecommendTodayView,
  normalizeRecommendKind,
  resolveMenuRecommendations,
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

function testResolveIsDeterministic() {
  const first = resolveMenuRecommendations(USER, initialGameState, TODAY)
  const second = resolveMenuRecommendations(USER, first.state, TODAY)

  assert.equal(first.changed, true)
  assert.equal(second.changed, false)
  assert.ok(first.state.recommendCoffeePrimaryId)
  assert.ok(first.state.recommendDinnerPrimaryId)
  assert.equal(
    first.state.recommendCoffeePrimaryId,
    second.state.recommendCoffeePrimaryId,
  )
}

function testTodayViewAndReroll() {
  const resolved = resolveMenuRecommendations(USER, initialGameState, TODAY).state
  const coffeeView = buildRecommendTodayView(resolved, 'coffee', TODAY)

  assert.equal(coffeeView.activeId, resolved.recommendCoffeePrimaryId)
  assert.equal(coffeeView.canReroll, true)

  const reroll = applyRecommendReroll(resolved, USER, 'coffee', TODAY)
  assert.equal(reroll.ok, true)
  assert.notEqual(reroll.menuId, coffeeView.activeId)

  const afterReroll = applyRecommendReroll(reroll.state, USER, 'coffee', TODAY)
  assert.equal(afterReroll.ok, false)
  assert.equal(afterReroll.reason, 'reroll-used')
}

testNormalizeKind()
testResolveIsDeterministic()
testTodayViewAndReroll()

console.log('test-menu-recommendations: ok')
