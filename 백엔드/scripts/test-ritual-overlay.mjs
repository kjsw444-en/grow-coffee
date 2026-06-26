import assert from 'node:assert/strict'
import { patchLocalDb, readLocalDb } from '../store.js'
import { getGameState, saveGameState } from '../db.js'
import { applyRitualFortuneReveal, applyRitualGiftOpen } from '../dailyRitual.js'
import { initialGameState } from '../constants.js'
import { getTodayKey } from '../waterQuota.js'

const userId = 'test-ritual-overlay-user'
const today = getTodayKey()

patchLocalDb((db) => {
  delete db.gameStates[userId]
  delete db.ritualOverlays?.[userId]
})

// DB에는 ritual 진행 없음, overlay에만 fortune revealed 저장된 상황 시뮬레이션
patchLocalDb((db) => {
  db.ritualOverlays ??= {}
  db.ritualOverlays[userId] = {
    ritualDayKey: today,
    ritualFortuneId: 'DAILY_GIFT',
    ritualFortuneRevealed: true,
    ritualFortuneProgress: 0,
    ritualFortuneClaimed: false,
    ritualGiftOpened: false,
    ritualGiftId: 'GIFT_COFFEE_2',
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
assert.equal(loaded.ritualFortuneRevealed, true, 'overlay fortune revealed should merge on load')
assert.equal(loaded.ritualGiftId, 'GIFT_COFFEE_2')

const gift = applyRitualGiftOpen(loaded, userId, today)
assert.equal(gift.ok, true, 'gift open should succeed after overlay merge')
assert.equal(gift.state.ritualGiftOpened, true)

console.log('test-ritual-overlay: passed')
