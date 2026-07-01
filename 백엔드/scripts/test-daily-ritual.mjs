import assert from 'node:assert/strict'

import {

  resolveDailyRitual,

  applyRitualFortuneReveal,

  applyRitualGiftOpen,

  applyRitualMissionClaim,

  buildRitualTodayView,

} from '../dailyRitual.js'

import { RITUAL_GIFT_DEFINITIONS, getRitualFortuneRevealCopy } from '../dailyRitualGifts.js'

import { applyDrink, applyWater, normalizeGameState } from '../gameLogic.js'

import { applyDailyLoginRouletteClaim } from '../dailyLoginRoulette.js'

import { applyMinigameReward } from '../minigameReward.js'

import { initialGameState } from '../constants.js'

import { getTodayKey } from '../waterQuota.js'



const userId = 'test-user-ritual'

const today = getTodayKey()



function test(name, fn) {

  try {

    fn()

    console.log(`ok - ${name}`)

  } catch (error) {

    console.error(`fail - ${name}`)

    throw error

  }

}



function freshState() {

  return resolveDailyRitual(userId, { ...initialGameState }, today)

}



test('resolveDailyRitual assigns gift for today', () => {

  const state = freshState()

  assert.equal(state.ritualDayKey, today)

  assert.equal(state.ritualFortuneId, 'DAILY_GIFT')

  assert.ok(state.ritualGiftId)

  assert.ok(RITUAL_GIFT_DEFINITIONS[state.ritualGiftId])

  assert.equal(state.ritualFortuneRevealed, false)

  assert.equal(state.ritualGiftOpened, false)

})



test('resolveDailyRitual keeps progress when only giftId missing', () => {
  const state = resolveDailyRitual(
    userId,
    {
      ...initialGameState,
      ritualDayKey: today,
      ritualFortuneId: 'DAILY_GIFT',
      ritualFortuneRevealed: true,
      ritualGiftOpened: false,
      ritualGiftId: '',
    },
    today,
  )

  assert.equal(state.ritualFortuneRevealed, true)
  assert.equal(state.ritualGiftOpened, false)
  assert.ok(state.ritualGiftId)
})



test('resolveDailyRitual rolls a new gift on day change', () => {
  const yesterday = '2099-01-01'
  const state = resolveDailyRitual(
    userId,
    {
      ...initialGameState,
      ritualDayKey: yesterday,
      ritualFortuneId: 'DAILY_GIFT',
      ritualFortuneRevealed: true,
      ritualGiftOpened: true,
      ritualGiftId: 'GIFT_COFFEE_2',
    },
    today,
  )

  assert.equal(state.ritualDayKey, today)
  assert.ok(state.ritualGiftId)
  assert.equal(state.ritualFortuneRevealed, false)
  assert.equal(state.ritualGiftOpened, false)
})



test('fortune reveal copy matches pre-rolled gift (3 variants)', () => {
  for (const giftId of Object.keys(RITUAL_GIFT_DEFINITIONS)) {
    const state = resolveDailyRitual(
      userId,
      { ...initialGameState, ritualDayKey: today, ritualFortuneId: 'DAILY_GIFT', ritualGiftId: giftId },
      today,
    )
    assert.equal(state.ritualGiftId, giftId)
    const reveal = applyRitualFortuneReveal(state, userId, today)
    assert.equal(reveal.ok, true)
    assert.equal(reveal.copy, getRitualFortuneRevealCopy(giftId))
  }
})



test('fortune reveal then gift open flow', () => {

  let state = freshState()

  const reveal = applyRitualFortuneReveal(state, userId, today)

  assert.equal(reveal.ok, true)

  state = reveal.state

  assert.equal(state.ritualFortuneRevealed, true)



  const gift = applyRitualGiftOpen(state, userId, today)

  assert.equal(gift.ok, true)

  state = gift.state

  assert.equal(state.ritualGiftOpened, true)



  const view = buildRitualTodayView(state)

  assert.equal(view.ritualComplete, true)

})



test('gift rewards apply coffee, passive, roulette', () => {
  const base = {
    ...initialGameState,
    ritualDayKey: today,
    ritualFortuneId: 'DAILY_GIFT',
  }

  const coffee = applyRitualGiftOpen(
    applyRitualFortuneReveal(
      resolveDailyRitual(userId, { ...base, ritualGiftId: 'GIFT_COFFEE_2' }, today),
      userId,
      today,
    ).state,
    userId,
    today,
  ).state
  assert.ok(Number(coffee.totalCoffees) >= 2)

  const roulette = applyRitualGiftOpen(
    applyRitualFortuneReveal(
      resolveDailyRitual(userId, { ...base, ritualGiftId: 'GIFT_ROULETTE' }, today),
      userId,
      today,
    ).state,
    userId,
    today,
  ).state
  assert.equal(roulette.ritualBonusRouletteSpins, 1)

})



test('missions complete grants 10 cups', () => {

  let state = freshState()

  state = applyRitualFortuneReveal(state, userId, today).state

  state = applyRitualGiftOpen(state, userId, today).state



  state = normalizeGameState({ ...state, growth: 100 })

  state = applyDrink(state, { randomValue: 0 }).state

  state = normalizeGameState({ ...state, growth: 100 })

  state = applyDrink(state, { randomValue: 0 }).state



  state = applyMinigameReward(state, 'mission1').state

  state = applyDailyLoginRouletteClaim(state, today).state



  const claim = applyRitualMissionClaim(state, today)

  assert.equal(claim.ok, true)

  assert.equal(claim.rewardCups, 10)

})



test('water uses base growth delta without legacy fortune buff', () => {

  let state = resolveDailyRitual(

    userId,

    { ...initialGameState, ritualFortuneRevealed: true, ritualDayKey: today, ritualGiftId: 'GIFT_COFFEE_2' },

    today,

  )



  const before = state.growth

  const watered = applyWater(state)

  assert.equal(watered.ok, true)

  assert.equal(watered.state.growth, before + 25)

})



console.log('test-daily-ritual: all passed')

