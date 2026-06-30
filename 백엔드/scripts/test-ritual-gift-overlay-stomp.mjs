import assert from 'node:assert/strict'
import { patchLocalDb } from '../store.js'
import { getGameState } from '../db.js'
import { ritualSeed } from '../dailyRitual.js'
import { pickRitualGiftId } from '../dailyRitualGifts.js'
import { initialGameState } from '../constants.js'
import { getTodayKey } from '../waterQuota.js'

const today = getTodayKey()

let userId = 'test-ritual-gift-overlay-stomp'
let expectedGiftId = pickRitualGiftId(ritualSeed(userId, today, 'gift'))
if (expectedGiftId === 'GIFT_ROULETTE') {
  userId = 'test-ritual-gift-overlay-stomp-alt'
  expectedGiftId = pickRitualGiftId(ritualSeed(userId, today, 'gift'))
}

assert.notEqual(
  expectedGiftId,
  'GIFT_ROULETTE',
  'could not find a seeded non-roulette gift for overlay stomp test',
)

patchLocalDb((db) => {
  delete db.gameStates[userId]
  delete db.ritualOverlays?.[userId]
  db.gameStates[userId] = {
    ...initialGameState,
    ritualDayKey: today,
    ritualFortuneId: 'DAILY_GIFT',
    ritualFortuneRevealed: false,
    ritualGiftOpened: false,
    ritualGiftId: '',
  }
})

// Stale overlay had a different gift locked in from an old session.
patchLocalDb((db) => {
  db.ritualOverlays ??= {}
  db.ritualOverlays[userId] = {
    ritualDayKey: today,
    ritualFortuneId: 'DAILY_GIFT',
    ritualFortuneRevealed: true,
    ritualFortuneProgress: 0,
    ritualFortuneClaimed: false,
    ritualGiftOpened: false,
    ritualGiftId: 'GIFT_ROULETTE',
    ritualMission1Id: 'M_HARVEST_2',
    ritualMission2Id: 'M_MINIGAME_ANY',
    ritualMission3Id: 'M_ROULETTE',
    ritualMission1Done: false,
    ritualMission2Done: false,
    ritualMission3Done: false,
    ritualMissionClaimed: false,
    ritualMissionHarvestCount: 0,
    ritualMissionMinigameDone: false,
    ritualMissionRouletteDone: false,
    ritualFertilizerCharges: 0,
    ritualBonusRouletteSpins: 0,
  }
})

const loaded = await getGameState(userId)

assert.equal(
  loaded.ritualGiftId,
  expectedGiftId,
  'resolved daily gift should win over stale overlay gift id',
)
assert.equal(
  loaded.ritualFortuneRevealed,
  false,
  'stale overlay progress is dropped when gift id conflicts',
)

console.log('test-ritual-gift-overlay-stomp: passed', { expectedGiftId })
