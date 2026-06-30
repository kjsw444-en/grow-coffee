import './loadEnv.js'
import cors from 'cors'
import express from 'express'
import path from 'node:path'
import fs from 'node:fs'
import {
  clearRitualOverlay,
  getGameState,
  getProfileDisplayName,
  handleTossUnlink,
  resolveGuestSession as resolveGuestProfile,
  resolveTossSession,
  saveGameState,
  setLastActionAt,
} from './db.js'
import {
  getPlayerRank,
  getRankingTop3RewardStatus,
  getTop50Rankings,
  finalizeDailyRankingForDev,
  RANKING_TOP3_REWARD_AMOUNT,
  submitRanking,
  syncRankingFromGameState,
} from './ranking.js'
import {
  BREWED_COFFEE_PROMOTION_CLAIM_TYPE,
  COFFEE_VALUE_CLAIM_TYPE,
  RANKING_TOP3_CLAIM_TYPE,
  deletePromotionClaim,
  findPromotionClaimByRewardKey,
  getPromotionClaim,
  recordPromotionClaim,
} from './promotionClaims.js'
import { isSupabaseAdminConfigured } from './supabase.js'
import { getStorageMode, isStorageReady, storageUnavailableMessage } from './storagePolicy.js'
import {
  getUserId,
  handleApiError,
  isDevRequest,
  requireStorage,
  requireUser,
} from './middleware.js'
import {
  applyClaimBrewedCoffeeFinishBonus,
  applyClaimPassiveCoffee,
  applyClaimAttendanceDaily,
  applyClaimAttendanceStreakBonus,
  applyDevBumpPassive,
  applyDevTestWater,
  applyDrink,
  applyPurchaseCoffeeVariant,
  applyReactivatePassiveCoffee,
  applyReset,
  applySelectCoffeeVariant,
  applySellBatch,
  applyShareReward,
  applyWatchAd,
  applyWater,
  getRankingBrewedSpend,
  getDailyRankingBrewedSpend,
} from './gameLogic.js'
import { applyMinigameReward } from './minigameReward.js'
import {
  applyDailyLoginRouletteClaim,
  applyDailyLoginRouletteRespinWithClientReward,
} from './dailyLoginRoulette.js'
import {
  applyRitualFortuneReveal,
  applyRitualGiftOpen,
  applyRitualFortuneClaim,
  applyRitualMissionClaim,
  buildRitualTodayView,
} from './dailyRitual.js'
import {
  applyDevAdvanceDailyRitualStep,
  applyDevCompleteDailyRitualMission,
  applyDevResetDailyRitual,
  applyDevSetDailyRitualFortune,
} from './dailyRitualDev.js'
import {
  applyRecommendReroll,
  buildRecommendTodayView,
  normalizeRecommendKind,
} from './menuRecommendations.js'
import { formatDrunkCoffeePurchaseCost } from './coffeeVariants.js'
import { grantBrewedCoffeeFields } from './brewedCoffeeReceived.js'
import { BREWED_COFFEE_DRINK_OPTIONS, BREWED_COFFEE_FINISH_BONUS_AMOUNT, BREWED_COFFEE_FINISH_BONUS_THRESHOLD, SHARE_REWARD_MODULE_ID, SELL_BATCH_SIZE, getBrewedCoffeePointReward } from './constants.js'
import { getTodayKey } from './waterQuota.js'
import { getBalanceRules, previewPassiveGrowth } from './passiveGrowth.js'
import {
  exchangeTossAuthorizationCode,
  verifyTossUnlinkCallbackAuth,
} from './tossAuth.js'
import { isTossDecryptConfigured } from './tossDecrypt.js'
import { isTossMtlsConfigured } from './tossTlsClient.js'
import { countVideoAssets, getMediaAssetRules, getVideoAssetsDir } from './mediaAssets.js'

const app = express()
const PORT = Number(process.env.PORT) || 8787
const VIDEO_ASSETS_DIR = getVideoAssetsDir()

if (fs.existsSync(VIDEO_ASSETS_DIR)) {
  app.use(
    '/assets/videos',
    express.static(VIDEO_ASSETS_DIR, {
      maxAge: '7d',
      setHeaders(res, filePath) {
        if (filePath.endsWith('.mp4')) {
          res.setHeader('Content-Type', 'video/mp4')
        }
      },
    }),
  )
}

async function attachPlayerRank(userId, payload) {
  if (!userId) {
    return payload
  }

  const playerRank = await getPlayerRank(userId)
  return { ...payload, playerRank }
}

app.use((req, res, next) => {
  if (req.headers['access-control-request-private-network'] === 'true') {
    res.setHeader('Access-Control-Allow-Private-Network', 'true')
  }
  next()
})

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true)

      const allowed =
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin.endsWith('.apps.tossmini.com') ||
        origin.endsWith('.private-apps.tossmini.com') ||
        origin.endsWith('.toss.im')

      callback(null, allowed)
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-grow-coffee-user', 'x-grow-coffee-dev'],
  }),
)
app.use(express.json({ limit: '512kb' }))

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'grow-coffee-api',
    storage: getStorageMode(),
    supabase: isSupabaseAdminConfigured(),
    storageReady: isStorageReady(),
    tossMtls: isTossMtlsConfigured(),
    tossDecrypt: isTossDecryptConfigured(),
    mediaAssets: getMediaAssetRules(),
    videoAssetsDir: path.basename(VIDEO_ASSETS_DIR),
    videoAssetsPresent: countVideoAssets() > 0,
  })
})

app.post('/api/auth/guest', requireStorage, async (req, res) => {
  const deviceId = String(req.body?.deviceId || '').trim()

  if (!deviceId) {
    res.status(400).json({ ok: false, message: 'deviceId가 필요합니다.' })
    return
  }

  try {
    const profile = await resolveGuestProfile(deviceId, req.body?.displayName)
    const state = await getGameState(profile.userId)
    const payload = await attachPlayerRank(profile.userId, {
      ok: true,
      ...profile,
      state,
      passiveGrowthPreview: previewPassiveGrowth(state),
      balanceRules: getBalanceRules(),
    })
    res.json(payload)
  } catch (error) {
    handleApiError(res, error)
  }
})

app.get('/api/game/state', requireUser, async (req, res) => {
  try {
    const state = await getGameState(req.userId)
    const payload = await attachPlayerRank(req.userId, {
      ok: true,
      state,
      passiveGrowthPreview: previewPassiveGrowth(state),
      balanceRules: getBalanceRules(),
    })
    res.json(payload)
  } catch (error) {
    handleApiError(res, error)
  }
})

app.post('/api/game/water', requireUser, async (req, res) => {
  try {
    const now = Date.now()

    const current = await getGameState(req.userId)
    const result = applyWater(current)

    if (!result.ok) {
      const messages = {
        'already-redeemed': '이미 목표를 달성했어요.',
        'ready-to-drink': '이제 커피를 마실 수 있어요.',
        'need-ad': '물주기·내리기 1회를 사용했어요. 「물 채우기」를 눌러 주세요.',
      }
      res.status(400).json({
        ok: false,
        message: messages[result.reason] || '물주기를 할 수 없어요.',
        state: result.state,
      })
      return
    }

    const state = await saveGameState(req.userId, result.state)
    setLastActionAt(req.userId, now)
    res.json({
      ok: true,
      state,
      lastEarned: result.lastEarned,
      passiveGrowthPreview: previewPassiveGrowth(state),
    })
  } catch (error) {
    handleApiError(res, error)
  }
})

/** DEV 전용 — 연타 테스트: 쿨다운·일일 물ota 없음 */
app.post('/api/game/dev/bump', requireUser, async (req, res) => {
  if (!isDevRequest(req)) {
    res.status(404).json({ ok: false, message: 'Not found' })
    return
  }

  try {
    const current = await getGameState(req.userId)
    const result = applyDevTestWater(current)

    if (!result.ok) {
      const messages = {
        'already-redeemed': '이미 목표를 달성했어요.',
        'ready-to-drink': '이제 커피를 마실 수 있어요.',
      }
      res.status(400).json({
        ok: false,
        message: messages[result.reason] || '테스트 물주기를 할 수 없어요.',
        state: result.state,
      })
      return
    }

    const state = await saveGameState(req.userId, result.state)
    res.json({
      ok: true,
      state,
      lastEarned: result.lastEarned,
      passiveGrowthPreview: previewPassiveGrowth(state),
    })
  } catch (error) {
    handleApiError(res, error)
  }
})

/** DEV 전용 — 방치 커피 게이지 +100% */
app.post('/api/game/dev/bump-passive', requireUser, async (req, res) => {
  if (!isDevRequest(req)) {
    res.status(404).json({ ok: false, message: 'Not found' })
    return
  }

  try {
    const current = await getGameState(req.userId)
    const result = applyDevBumpPassive(current)

    if (!result.ok) {
      const messages = {
        'already-redeemed': '이미 목표를 달성했어요.',
        'daily-limit': '오늘 방치 커피는 모두 받았어요.',
      }
      res.status(400).json({
        ok: false,
        message: messages[result.reason] || '방치 커피 테스트 충전을 할 수 없어요.',
        state: result.state,
      })
      return
    }

    const state = await saveGameState(req.userId, result.state)
    res.json({
      ok: true,
      state,
      passiveGrowthPreview: previewPassiveGrowth(state),
    })
  } catch (error) {
    handleApiError(res, error)
  }
})

/** DEV 전용 — 내린 커피 잔 수 설정 */
app.post('/api/game/dev/set-coffees', requireUser, async (req, res) => {
  if (!isDevRequest(req)) {
    res.status(404).json({ ok: false, message: 'Not found' })
    return
  }

  const totalCoffees = Math.max(0, Math.floor(Number(req.body?.totalCoffees ?? 0)))

  try {
    const current = await getGameState(req.userId)
    const state = await saveGameState(req.userId, { ...current, totalCoffees }, { allowTotalCoffeeDecrease: true })
    res.json({
      ok: true,
      state,
      passiveGrowthPreview: previewPassiveGrowth(state),
    })
  } catch (error) {
    handleApiError(res, error)
  }
})

/** DEV 전용 — 마신 커피(spentCoffeeCups) 잔 수 설정 */
app.post('/api/game/dev/set-drunk-coffees', requireUser, async (req, res) => {
  if (!isDevRequest(req)) {
    res.status(404).json({ ok: false, message: 'Not found' })
    return
  }

  const spentCoffeeCups = Math.max(0, Math.floor(Number(req.body?.spentCoffeeCups ?? 0)))

  try {
    const current = await getGameState(req.userId)
    const lifetimeDrunkCoffees = Math.max(
      Number(current.lifetimeDrunkCoffees ?? 0),
      spentCoffeeCups,
    )
    const state = await saveGameState(req.userId, {
      ...current,
      spentCoffeeCups,
      lifetimeDrunkCoffees,
    })
    res.json({
      ok: true,
      state,
      passiveGrowthPreview: previewPassiveGrowth(state),
    })
  } catch (error) {
    handleApiError(res, error)
  }
})

/** 출시 테스트 — 마신 커피 +1000 (고정) */
const RELEASE_TEST_ADD_DRUNK_COFFEES = 1000
/** 출시 테스트 — 내린 커피 +1000 (고정) */
const RELEASE_TEST_ADD_BREWED_COFFEES = 1000

app.post('/api/game/release-test/add-drunk-coffees', requireUser, async (req, res) => {
  const amount = RELEASE_TEST_ADD_DRUNK_COFFEES

  try {
    const current = await getGameState(req.userId)
    const spentCoffeeCups = current.spentCoffeeCups + amount
    const lifetimeDrunkCoffees = Math.max(Number(current.lifetimeDrunkCoffees ?? 0), spentCoffeeCups)
    const state = await saveGameState(req.userId, {
      ...current,
      spentCoffeeCups,
      lifetimeDrunkCoffees,
    })
    res.json({
      ok: true,
      state,
      added: amount,
      passiveGrowthPreview: previewPassiveGrowth(state),
    })
  } catch (error) {
    handleApiError(res, error)
  }
})

app.post('/api/game/release-test/add-brewed-coffees', requireUser, async (req, res) => {
  const amount = RELEASE_TEST_ADD_BREWED_COFFEES

  try {
    const current = await getGameState(req.userId)
    const state = await saveGameState(req.userId, {
      ...current,
      ...grantBrewedCoffeeFields(current, amount),
    })
    res.json({
      ok: true,
      state,
      added: amount,
      passiveGrowthPreview: previewPassiveGrowth(state),
    })
  } catch (error) {
    handleApiError(res, error)
  }
})

/** 출시 테스트 — 마신 커피(spentCoffeeCups) 서버 동기화 (로컬 ≥ 서버일 때 상점 구매 전 호출) */
app.post('/api/game/release-test/sync-spent-coffees', requireUser, async (req, res) => {
  const targetSpent = Math.max(0, Math.floor(Number(req.body?.spentCoffeeCups ?? 0)))

  try {
    const current = await getGameState(req.userId)
    const spentCoffeeCups = Math.max(current.spentCoffeeCups, targetSpent)
    const lifetimeDrunkCoffees = Math.max(Number(current.lifetimeDrunkCoffees ?? 0), spentCoffeeCups)
    const state = await saveGameState(req.userId, {
      ...current,
      spentCoffeeCups,
      lifetimeDrunkCoffees,
    })
    res.json({
      ok: true,
      state,
      passiveGrowthPreview: previewPassiveGrowth(state),
    })
  } catch (error) {
    handleApiError(res, error)
  }
})

/** DEV 전용 — 접속 룰렛 수령 상태 초기화 */
app.post('/api/game/dev/reset-daily-roulette', requireUser, async (req, res) => {
  if (!isDevRequest(req)) {
    res.status(404).json({ ok: false, message: 'Not found' })
    return
  }

  try {
    const current = await getGameState(req.userId)
    const state = await saveGameState(req.userId, {
      ...current,
      dailyLoginRouletteDayKey: '',
      dailyLoginRouletteRewardCups: 0,
      dailyLoginRouletteRespinDayKey: '',
    })
    res.json({
      ok: true,
      state,
      passiveGrowthPreview: previewPassiveGrowth(state),
    })
  } catch (error) {
    handleApiError(res, error)
  }
})

/** DEV 전용 — 어제 랭킹 TOP3 토스 지급 기록 초기화 */
app.post('/api/game/dev/reset-ranking-top3-promotion', requireUser, async (req, res) => {
  if (!isDevRequest(req)) {
    res.status(404).json({ ok: false, message: 'Not found' })
    return
  }

  try {
    const status = await getRankingTop3RewardStatus(req.userId)
    await deletePromotionClaim(req.userId, RANKING_TOP3_CLAIM_TYPE, status.rewardDayKey)
    res.json({ ok: true, rewardDayKey: status.rewardDayKey })
  } catch (error) {
    handleApiError(res, error)
  }
})

/** DEV 전용 — 오늘 랭킹을 어제 마감 랭킹으로 즉시 확정 */
app.post('/api/game/dev/finalize-ranking', requireUser, async (req, res) => {
  if (!isDevRequest(req)) {
    res.status(404).json({ ok: false, message: 'Not found' })
    return
  }

  try {
    const state = await getGameState(req.userId)
    const displayName = await getProfileDisplayName(req.userId)
    const result = await finalizeDailyRankingForDev(
      req.userId,
      displayName,
      getDailyRankingBrewedSpend(state),
    )
    res.json(result)
  } catch (error) {
    handleApiError(res, error)
  }
})

/** DEV 전용 — 오늘의 커피 운세 초기화 */
app.post('/api/game/dev/reset-daily-ritual', requireUser, async (req, res) => {
  if (!isDevRequest(req)) {
    res.status(404).json({ ok: false, message: 'Not found' })
    return
  }

  try {
    const current = await getGameState(req.userId)
    const result = applyDevResetDailyRitual(req.userId, current)
    const state = await saveGameState(req.userId, result.state)
    res.json({
      ok: true,
      state,
      ritual: buildRitualTodayView(state),
    })
  } catch (error) {
    handleApiError(res, error)
  }
})

/** DEV 전용 — 오늘의 커피 운세 종류 지정 */
app.post('/api/game/dev/set-daily-ritual-fortune', requireUser, async (req, res) => {
  if (!isDevRequest(req)) {
    res.status(404).json({ ok: false, message: 'Not found' })
    return
  }

  try {
    const current = await getGameState(req.userId)
    const result = applyDevSetDailyRitualFortune(req.userId, current, req.body?.fortuneId)

    if (!result.ok) {
      res.status(400).json({
        ok: false,
        message: '운세 종류를 확인할 수 없어요.',
        state: result.state,
      })
      return
    }

    const state = await saveGameState(req.userId, result.state)
    res.json({
      ok: true,
      state,
      fortuneId: result.fortuneId,
      ritual: buildRitualTodayView(state),
    })
  } catch (error) {
    handleApiError(res, error)
  }
})

/** DEV 전용 — 오늘의 미션 1개 즉시 완료 */
app.post('/api/game/dev/complete-daily-ritual-mission', requireUser, async (req, res) => {
  if (!isDevRequest(req)) {
    res.status(404).json({ ok: false, message: 'Not found' })
    return
  }

  try {
    const current = await getGameState(req.userId)
    const result = applyDevCompleteDailyRitualMission(current, req.body?.mission)

    if (!result.ok) {
      const messages = {
        'day-mismatch': '오늘 운세를 먼저 불러와 주세요.',
        'invalid-mission': '미션 종류를 확인할 수 없어요.',
      }
      res.status(400).json({
        ok: false,
        message: messages[result.reason] || '미션을 완료할 수 없어요.',
        state: result.state,
      })
      return
    }

    const state = await saveGameState(req.userId, result.state)
    res.json({
      ok: true,
      state,
      missionKind: result.missionKind,
      ritual: buildRitualTodayView(state),
    })
  } catch (error) {
    handleApiError(res, error)
  }
})

/** DEV 전용 — 운세 확인·선물 열기 단계 건너뛰기 */
app.post('/api/game/dev/advance-daily-ritual', requireUser, async (req, res) => {
  if (!isDevRequest(req)) {
    res.status(404).json({ ok: false, message: 'Not found' })
    return
  }

  try {
    const current = await getGameState(req.userId)
    const result = applyDevAdvanceDailyRitualStep(req.userId, current, req.body?.step)

    if (!result.ok) {
      const messages = {
        'already-revealed': '오늘 운세는 이미 확인했어요.',
        'already-opened': '오늘 선물은 이미 열었어요.',
        'fortune-not-revealed': '먼저 오늘의 운세를 확인해 주세요.',
        'invalid-step': '단계를 확인할 수 없어요.',
      }
      res.status(400).json({
        ok: false,
        message: messages[result.reason] || '진행할 수 없어요.',
        state: result.state,
      })
      return
    }

    const state = await saveGameState(req.userId, result.state)
    res.json({
      ok: true,
      state,
      step: req.body?.step,
      copy: result.copy ?? null,
      ritual: buildRitualTodayView(state),
    })
  } catch (error) {
    handleApiError(res, error)
  }
})

app.post('/api/game/watch-ad', requireUser, async (req, res) => {
  try {
    const current = await getGameState(req.userId)
    const result = applyWatchAd(current)

    if (!result.ok) {
      const messages = {
        'already-redeemed': '이미 목표를 달성했어요.',
        'not-needed': '아직 물주기·내리기를 사용하지 않았거나, 이미 물 채우기를 받았어요.',
      }
      res.status(400).json({
        ok: false,
        message: messages[result.reason] || '물 채우기를 받을 수 없어요.',
        state: result.state,
      })
      return
    }

    const state = await saveGameState(req.userId, result.state)
    res.json({ ok: true, state })
  } catch (error) {
    handleApiError(res, error)
  }
})

app.post('/api/game/share-reward', requireUser, async (req, res) => {
  try {
    const moduleId = String(req.body?.moduleId || '').trim()
    const devBypass = isDevRequest(req)

    if (moduleId && moduleId !== SHARE_REWARD_MODULE_ID && !devBypass) {
      res.status(400).json({
        ok: false,
        message: '유효하지 않은 공유 리워드입니다.',
      })
      return
    }

    const current = await getGameState(req.userId)
    const result = applyShareReward(current)

    if (!result.ok) {
      const messages = {
        'already-redeemed': '이미 목표를 달성했어요.',
        'already-claimed': '오늘 공유 리워드는 이미 받았어요. 내일 다시 시도해 주세요.',
      }
      res.status(400).json({
        ok: false,
        message: messages[result.reason] || '공유 리워드를 받을 수 없어요.',
        state: result.state,
      })
      return
    }

    const state = await saveGameState(req.userId, result.state)
    const displayName = await getProfileDisplayName(req.userId)

    const payload = await attachPlayerRank(req.userId, {
      ok: true,
      state,
      rewardAmount: result.rewardAmount,
      passiveGrowthPreview: previewPassiveGrowth(state),
    })
    res.json(payload)
  } catch (error) {
    handleApiError(res, error)
  }
})

app.post('/api/game/brewed-coffee-finish-bonus', requireUser, async (req, res) => {
  try {
    const current = await getGameState(req.userId)
    const result = applyClaimBrewedCoffeeFinishBonus(current)

    if (!result.ok) {
      const messages = {
        'already-ready': `${SELL_BATCH_SIZE}잔을 채웠어요. 내린 커피 마시기를 눌러 주세요.`,
        'not-close-enough': `${BREWED_COFFEE_FINISH_BONUS_THRESHOLD}잔부터 마지막 +${BREWED_COFFEE_FINISH_BONUS_AMOUNT}잔을 받을 수 있어요.`,
      }
      res.status(400).json({
        ok: false,
        message: messages[result.reason] || '마지막 부스트를 받을 수 없어요.',
        state: result.state,
      })
      return
    }

    const state = await saveGameState(req.userId, result.state)
    const payload = await attachPlayerRank(req.userId, {
      ok: true,
      state,
      rewardCups: result.rewardCups,
      passiveGrowthPreview: previewPassiveGrowth(state),
    })
    res.json(payload)
  } catch (error) {
    handleApiError(res, error)
  }
})

app.post('/api/game/minigame-reward', requireUser, async (req, res) => {
  try {
    const missionKey = String(req.body?.missionKey || '').trim()
    const rewardSlot = req.body?.rewardSlot === 'ad' ? 'ad' : 'free'
    const current = await getGameState(req.userId)
    const result = applyMinigameReward(current, missionKey, rewardSlot)

    if (!result.ok) {
      const messages = {
        'invalid-mission': '유효하지 않은 미션입니다.',
        'already-claimed': '오늘 이 난이도 보상은 이미 받았어요.',
      }
      res.status(400).json({
        ok: false,
        message: messages[result.reason] || '미션 보상을 받을 수 없어요.',
        state: result.state,
      })
      return
    }

    const state = await saveGameState(req.userId, result.state)

    const payload = await attachPlayerRank(req.userId, {
      ok: true,
      state,
      rewardCups: result.rewardCups,
      passiveGrowthPreview: previewPassiveGrowth(state),
    })
    res.json(payload)
  } catch (error) {
    handleApiError(res, error)
  }
})

app.post('/api/game/daily-login-roulette', requireUser, async (req, res) => {
  try {
    const current = await getGameState(req.userId)
    const result = applyDailyLoginRouletteClaim(current)

    if (!result.ok) {
      res.status(400).json({
        ok: false,
        message: '오늘 접속 룰렛은 이미 받았어요.',
        state: result.state,
      })
      return
    }

    const state = await saveGameState(req.userId, result.state)

    const payload = await attachPlayerRank(req.userId, {
      ok: true,
      state,
      rewardCups: result.rewardCups,
      bonusSpin: result.bonusSpin === true,
      passiveGrowthPreview: previewPassiveGrowth(state),
    })
    res.json(payload)
  } catch (error) {
    handleApiError(res, error)
  }
})

app.post('/api/game/daily-login-roulette/respin', requireUser, async (req, res) => {
  try {
    const current = await getGameState(req.userId)
    const result = applyDailyLoginRouletteRespinWithClientReward(current, {
      clientDateKey: req.body?.dateKey,
      previousRewardCups: req.body?.previousRewardCups,
    })

    if (!result.ok) {
      const message =
        result.reason === 'respin-used'
          ? '오늘 다시 돌리기는 이미 사용했어요.'
          : result.reason === 'reward-state-missing'
            ? '룰렛 보상 정보를 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.'
            : '먼저 오늘의 룰렛을 돌려 주세요.'
      res.status(400).json({
        ok: false,
        message,
        state: result.state,
      })
      return
    }

    const state = await saveGameState(req.userId, result.state, { allowTotalCoffeeDecrease: true })

    const payload = await attachPlayerRank(req.userId, {
      ok: true,
      state,
      rewardCups: result.rewardCups,
      previousRewardCups: result.previousRewardCups,
      passiveGrowthPreview: previewPassiveGrowth(state),
    })
    res.json(payload)
  } catch (error) {
    handleApiError(res, error)
  }
})

app.get('/api/ritual/today', requireUser, async (req, res) => {
  try {
    const state = await getGameState(req.userId)
    res.json({
      ok: true,
      state,
      ritual: buildRitualTodayView(state),
    })
  } catch (error) {
    handleApiError(res, error)
  }
})

app.post('/api/ritual/fortune/reveal', requireUser, async (req, res) => {
  try {
    const current = await getGameState(req.userId)
    const result = applyRitualFortuneReveal(current, req.userId)

    if (!result.ok) {
      const messages = {
        'already-revealed': '오늘 운세는 이미 확인했어요.',
        'day-mismatch': '오늘 운세를 다시 불러와 주세요.',
        'fortune-missing': '운세 정보를 불러오지 못했어요.',
      }
      res.status(400).json({
        ok: false,
        message: messages[result.reason] || '운세를 확인할 수 없어요.',
        state: result.state,
      })
      return
    }

    const state = await saveGameState(req.userId, result.state)
    res.json({
      ok: true,
      state,
      fortuneId: result.fortuneId,
      copy: result.copy,
      ritual: buildRitualTodayView(state),
    })
  } catch (error) {
    handleApiError(res, error)
  }
})

app.post('/api/ritual/gift/open', requireUser, async (req, res) => {
  try {
    const current = await getGameState(req.userId)
    const result = applyRitualGiftOpen(current, req.userId)

    if (!result.ok) {
      const messages = {
        'fortune-not-revealed': '먼저 오늘의 운세를 확인해 주세요.',
        'already-opened': '오늘 선물은 이미 열었어요.',
        'day-mismatch': '오늘 선물을 다시 불러와 주세요.',
        'gift-missing': '선물 정보를 불러오지 못했어요.',
      }
      res.status(400).json({
        ok: false,
        message: messages[result.reason] || '선물을 열 수 없어요.',
        state: result.state,
      })
      return
    }

    const state = await saveGameState(req.userId, result.state)
    const payload = await attachPlayerRank(req.userId, {
      ok: true,
      state,
      giftId: result.giftId,
      label: result.label,
      copy: result.copy,
      ritual: buildRitualTodayView(state),
    })
    res.json(payload)
  } catch (error) {
    handleApiError(res, error)
  }
})

app.post('/api/ritual/fortune/claim', requireUser, async (req, res) => {
  try {
    const current = await getGameState(req.userId)
    const result = applyRitualFortuneClaim(current)

    if (!result.ok) {
      const messages = {
        'not-harvest-fortune': '오늘은 수확 보너스 운세가 아니에요.',
        'fortune-not-revealed': '먼저 오늘의 운세를 확인해 주세요.',
        'already-claimed': '오늘 수확 보너스는 이미 받았어요.',
        'progress-incomplete': '아직 수확 목표를 달성하지 못했어요.',
        'day-mismatch': '오늘 보상을 다시 불러와 주세요.',
      }
      res.status(400).json({
        ok: false,
        message: messages[result.reason] || '보너스를 받을 수 없어요.',
        state: result.state,
      })
      return
    }

    const state = await saveGameState(req.userId, result.state)
    res.json({
      ok: true,
      state,
      rewardCups: result.rewardCups,
      ritual: buildRitualTodayView(state),
    })
  } catch (error) {
    handleApiError(res, error)
  }
})

app.post('/api/ritual/missions/claim', requireUser, async (req, res) => {
  try {
    const current = await getGameState(req.userId)
    const result = applyRitualMissionClaim(current)

    if (!result.ok) {
      const messages = {
        'already-claimed': '오늘 미션 보상은 이미 받았어요.',
        'missions-incomplete': '아직 미션을 모두 완료하지 못했어요.',
        'day-mismatch': '오늘 미션을 다시 불러와 주세요.',
      }
      res.status(400).json({
        ok: false,
        message: messages[result.reason] || '미션 보상을 받을 수 없어요.',
        state: result.state,
      })
      return
    }

    const state = await saveGameState(req.userId, result.state)
    res.json({
      ok: true,
      state,
      rewardCups: result.rewardCups,
      ritual: buildRitualTodayView(state),
    })
  } catch (error) {
    handleApiError(res, error)
  }
})

app.get('/api/recommend/today', requireUser, async (req, res) => {
  try {
    const kind = normalizeRecommendKind(req.query?.kind)
    if (!kind) {
      res.status(400).json({ ok: false, message: '추천 종류를 확인할 수 없어요.' })
      return
    }

    const state = await getGameState(req.userId)
    const recommend = buildRecommendTodayView(state, req.userId, kind)

    res.json({
      ok: true,
      state,
      kind,
      recommend,
      menuId: recommend.activeId,
    })
  } catch (error) {
    handleApiError(res, error)
  }
})

app.post('/api/recommend/reroll', requireUser, async (req, res) => {
  try {
    const kind = normalizeRecommendKind(req.body?.kind)
    if (!kind) {
      res.status(400).json({ ok: false, message: '추천 종류를 확인할 수 없어요.' })
      return
    }

    const current = await getGameState(req.userId)
    const result = applyRecommendReroll(current, req.userId, kind)

    if (!result.ok) {
      const messages = {
        'reroll-used': '오늘은 이미 다른 메뉴를 추천받았어요.',
      }
      res.status(400).json({
        ok: false,
        message: messages[result.reason] || '다른 메뉴를 추천받을 수 없어요.',
        state: result.state,
      })
      return
    }

    const state = await saveGameState(req.userId, result.state)
    res.json({
      ok: true,
      state,
      kind,
      menuId: result.menuId,
      previousId: result.previousId,
      recommend: buildRecommendTodayView(state, req.userId, kind),
    })
  } catch (error) {
    handleApiError(res, error)
  }
})

app.post('/api/game/claim-passive-coffee', requireUser, async (req, res) => {
  try {
    const current = await getGameState(req.userId)
    const result = applyClaimPassiveCoffee(current)

    if (!result.ok) {
      const messages = {
        'already-redeemed': '이미 목표를 달성했어요.',
        'not-ready': '아직 방치 커피가 차지 않았어요.',
        'daily-limit': '오늘 방치 커피는 모두 받았어요.',
      }
      res.status(400).json({
        ok: false,
        message: messages[result.reason] || '방치 커피를 받을 수 없어요.',
        state: result.state,
      })
      return
    }

    const state = await saveGameState(req.userId, result.state)
    res.json({
      ok: true,
      state,
      lastEarned: result.lastEarned,
      passiveGrowthPreview: previewPassiveGrowth(state),
    })
  } catch (error) {
    handleApiError(res, error)
  }
})

app.post('/api/game/reactivate-passive-coffee', requireUser, async (req, res) => {
  try {
    const current = await getGameState(req.userId)
    const result = applyReactivatePassiveCoffee(current)

    if (!result.ok) {
      const messages = {
        'already-redeemed': '이미 목표를 달성했어요.',
        'not-complete': '방치 커피 2잔을 모두 받은 뒤 재활성할 수 있어요.',
        'already-reactivated': '오늘 방치 커피 재활성은 이미 사용했어요.',
      }
      res.status(400).json({
        ok: false,
        message: messages[result.reason] || '방치 커피를 재활성할 수 없어요.',
        state: result.state,
      })
      return
    }

    const state = await saveGameState(req.userId, result.state)
    const payload = await attachPlayerRank(req.userId, {
      ok: true,
      state,
      passiveGrowthPreview: previewPassiveGrowth(state),
    })
    res.json(payload)
  } catch (error) {
    handleApiError(res, error)
  }
})

app.post('/api/game/drink', requireUser, async (req, res) => {
  try {
    const current = await getGameState(req.userId)
    const result = applyDrink(current)

    if (!result.ok) {
      const messages = {
        'already-redeemed': '이미 목표를 달성했어요.',
        'not-ready': '아직 커피가 완성되지 않았어요.',
      }
      res.status(400).json({
        ok: false,
        message: messages[result.reason] || '커피를 마실 수 없어요.',
        state: result.state,
      })
      return
    }

    const state = await saveGameState(req.userId, result.state)
    const displayName = await getProfileDisplayName(req.userId)
    await syncRankingFromGameState(req.userId, state, displayName)

    const payload = await attachPlayerRank(req.userId, {
      ok: true,
      state,
      lastEarned: result.lastEarned,
      passiveGrowthPreview: previewPassiveGrowth(state),
      attendanceGoalJustMet: result.attendanceGoalJustMet ?? false,
    })
    res.json(payload)
  } catch (error) {
    handleApiError(res, error)
  }
})

app.post('/api/game/claim-attendance-daily', requireUser, async (req, res) => {
  try {
    const current = await getGameState(req.userId)
    const result = applyClaimAttendanceDaily(current)

    if (!result.ok) {
      const messages = {
        'goal-not-met': '오늘 출석 목표를 먼저 달성해 주세요.',
        'already-claimed': '오늘 출석 보상은 이미 받았어요.',
      }
      res.status(400).json({
        ok: false,
        message: messages[result.reason] || '출석 보상을 받을 수 없어요.',
        state: result.state,
      })
      return
    }

    const state = await saveGameState(req.userId, result.state)
    const payload = await attachPlayerRank(req.userId, {
      ok: true,
      state,
      rewardCups: result.rewardCups,
      passiveGrowthPreview: previewPassiveGrowth(state),
    })
    res.json(payload)
  } catch (error) {
    handleApiError(res, error)
  }
})

app.post('/api/game/claim-attendance-streak', requireUser, async (req, res) => {
  try {
    const current = await getGameState(req.userId)
    const result = applyClaimAttendanceStreakBonus(current)

    if (!result.ok) {
      const messages = {
        'not-available': '7일 연속 출석 보너스를 받을 수 없어요.',
      }
      res.status(400).json({
        ok: false,
        message: messages[result.reason] || '연속 출석 보너스를 받을 수 없어요.',
        state: result.state,
      })
      return
    }

    const state = await saveGameState(req.userId, result.state)
    const payload = await attachPlayerRank(req.userId, {
      ok: true,
      state,
      rewardCups: result.rewardCups,
      passiveGrowthPreview: previewPassiveGrowth(state),
    })
    res.json(payload)
  } catch (error) {
    handleApiError(res, error)
  }
})

app.post('/api/game/sell-batch', requireUser, async (req, res) => {
  const cupCount = Math.floor(Number(req.body?.cupCount ?? SELL_BATCH_SIZE))

  try {
    const current = await getGameState(req.userId)
    const result = applySellBatch(current, cupCount)

    if (!result.ok) {
      const messages = {
        'daily-point-cap-reached': '오늘은 커피 한 잔 값(4,700원)만큼 받았어요. 내일 다시 도전해 주세요.',
        'invalid-batch-size': `내린 커피는 ${BREWED_COFFEE_DRINK_OPTIONS.join(', ')}잔 중에서 선택해 주세요.`,
        'not-enough-cups': `내린 커피 ${cupCount}잔이 필요해요.`,
      }
      res.status(400).json({
        ok: false,
        message: messages[result.reason] || '내린 커피를 마실 수 없어요.',
        state: result.state,
      })
      return
    }

    const state = await saveGameState(req.userId, result.state, { allowTotalCoffeeDecrease: true })
    const displayName = await getProfileDisplayName(req.userId)
    await syncRankingFromGameState(req.userId, state, displayName)

    const payload = await attachPlayerRank(req.userId, {
      ok: true,
      state,
      lastEarned: result.lastEarned,
      dailyCapJustReached: result.dailyCapJustReached === true,
      passiveGrowthPreview: previewPassiveGrowth(state),
    })
    res.json(payload)
  } catch (error) {
    handleApiError(res, error)
  }
})

app.post('/api/game/purchase-variant', requireUser, async (req, res) => {
  const slug = String(req.body?.slug || '').trim()

  try {
    const current = await getGameState(req.userId)
    const result = applyPurchaseCoffeeVariant(current, slug)

    if (!result.ok) {
      const messages = {
        'invalid-variant': '존재하지 않는 캐릭터예요.',
        'already-free': '기본 캐릭터는 구매할 수 없어요.',
        'already-owned': '이미 보유한 캐릭터예요.',
        'not-enough-cups': `${formatDrunkCoffeePurchaseCost()}이 필요해요.`,
      }
      res.status(400).json({
        ok: false,
        message: messages[result.reason] || '구매할 수 없어요.',
        state: result.state,
      })
      return
    }

    const state = await saveGameState(req.userId, result.state)

    const payload = await attachPlayerRank(req.userId, { ok: true, state })
    res.json(payload)
  } catch (error) {
    handleApiError(res, error)
  }
})

app.post('/api/game/select-variant', requireUser, async (req, res) => {
  const slug = String(req.body?.slug || '').trim()

  try {
    const current = await getGameState(req.userId)
    const result = applySelectCoffeeVariant(current, slug)

    if (!result.ok) {
      const messages = {
        'invalid-variant': '존재하지 않는 캐릭터예요.',
        'not-owned': '아직 보유하지 않은 캐릭터예요.',
      }
      res.status(400).json({
        ok: false,
        message: messages[result.reason] || '선택할 수 없어요.',
        state: result.state,
      })
      return
    }

    const state = await saveGameState(req.userId, result.state)
    res.json({ ok: true, state })
  } catch (error) {
    handleApiError(res, error)
  }
})

app.post('/api/game/reset', requireUser, async (req, res) => {
  try {
    const current = await getGameState(req.userId)
    const result = applyReset(current)
    clearRitualOverlay(req.userId)
    const state = await saveGameState(req.userId, result.state, { allowTotalCoffeeDecrease: true })
    setLastActionAt(req.userId, 0)
    const displayName = await getProfileDisplayName(req.userId)
    await syncRankingFromGameState(req.userId, state, displayName)
    const payload = await attachPlayerRank(req.userId, { ok: true, state })
    res.json(payload)
  } catch (error) {
    handleApiError(res, error)
  }
})

app.get('/api/ranking/top50', requireStorage, async (req, res) => {
  try {
    const payload = await getTop50Rankings(getUserId(req))
    res.json(payload)
  } catch (error) {
    handleApiError(res, error)
  }
})

app.post('/api/ranking/submit', requireStorage, requireUser, async (req, res) => {
  const displayName = String(req.body?.displayName || '').trim()

  try {
    const current = await getGameState(req.userId)
    const safeScore = getDailyRankingBrewedSpend(current)
    const safeName = displayName || (await getProfileDisplayName(req.userId))
    const payload = await submitRanking(req.userId, safeScore, safeName)
    res.json(payload)
  } catch (error) {
    handleApiError(res, error)
  }
})

app.get('/api/promotion/coffee-value/status', requireStorage, requireUser, async (req, res) => {
  try {
    const claim = await getPromotionClaim(req.userId, COFFEE_VALUE_CLAIM_TYPE)
    res.json({
      ok: true,
      claimed: Boolean(claim),
      rewardKey: claim?.reward_key ?? claim?.rewardKey ?? null,
    })
  } catch (error) {
    handleApiError(res, error)
  }
})

app.post('/api/promotion/coffee-value/claim', requireStorage, requireUser, async (req, res) => {
  const rewardKey = String(req.body?.rewardKey ?? '').trim()

  if (!rewardKey) {
    res.status(400).json({ ok: false, message: 'rewardKey가 필요합니다.' })
    return
  }

  try {
    const existing = await getPromotionClaim(req.userId, COFFEE_VALUE_CLAIM_TYPE)
    if (existing) {
      const current = await getGameState(req.userId)
      res.json({
        ok: true,
        alreadyClaimed: true,
        rewardKey: existing.reward_key ?? existing.rewardKey ?? null,
        state: current,
      })
      return
    }

    const claim = await recordPromotionClaim({
      userId: req.userId,
      claimType: COFFEE_VALUE_CLAIM_TYPE,
      rewardKey,
    })
    const current = await getGameState(req.userId)
    res.json({
      ok: true,
      alreadyClaimed: false,
      rewardKey: claim.reward_key ?? claim.rewardKey ?? rewardKey,
      state: current,
    })
  } catch (error) {
    handleApiError(res, error)
  }
})

app.post('/api/promotion/brewed-coffee/claim', requireStorage, requireUser, async (req, res) => {
  const rewardKey = String(req.body?.rewardKey ?? '').trim()
  const cupCount = Math.floor(Number(req.body?.cupCount ?? 0))
  const amount = Math.floor(Number(req.body?.amount ?? 0))

  if (!rewardKey) {
    res.status(400).json({ ok: false, message: 'rewardKey가 필요합니다.' })
    return
  }

  if (!BREWED_COFFEE_DRINK_OPTIONS.includes(cupCount)) {
    res.status(400).json({ ok: false, message: '프로모션 지급 가능한 잔 수가 아니에요.' })
    return
  }

  const expectedAmount = getBrewedCoffeePointReward(cupCount)
  if (amount <= 0 || amount !== expectedAmount) {
    res.status(400).json({ ok: false, message: '프로모션 지급 금액이 올바르지 않아요.' })
    return
  }

  try {
    const existing = await findPromotionClaimByRewardKey(req.userId, rewardKey)
    if (existing) {
      const current = await getGameState(req.userId)
      res.json({
        ok: true,
        alreadyClaimed: true,
        rewardKey: existing.reward_key ?? existing.rewardKey ?? rewardKey,
        cupCount,
        amount,
        state: current,
      })
      return
    }

    const claim = await recordPromotionClaim({
      userId: req.userId,
      claimType: BREWED_COFFEE_PROMOTION_CLAIM_TYPE,
      dayKey: `${getTodayKey()}:${rewardKey}`,
      rewardKey,
    })
    const current = await getGameState(req.userId)
    res.json({
      ok: true,
      alreadyClaimed: false,
      rewardKey: claim.reward_key ?? claim.rewardKey ?? rewardKey,
      cupCount,
      amount,
      state: current,
    })
  } catch (error) {
    handleApiError(res, error)
  }
})

app.get('/api/promotion/ranking-top3/status', requireStorage, requireUser, async (req, res) => {
  try {
    const status = await getRankingTop3RewardStatus(req.userId)
    res.json({ ok: true, ...status })
  } catch (error) {
    handleApiError(res, error)
  }
})

app.post('/api/promotion/ranking-top3/claim', requireStorage, requireUser, async (req, res) => {
  const rewardKey = String(req.body?.rewardKey ?? '').trim()

  if (!rewardKey) {
    res.status(400).json({ ok: false, message: 'rewardKey가 필요합니다.' })
    return
  }

  try {
    const status = await getRankingTop3RewardStatus(req.userId)

    if (!status.eligible) {
      res.status(403).json({
        ok: false,
        message: '어제 마감 랭킹 1위~3위만 받을 수 있어요.',
        ...status,
      })
      return
    }

    if (status.claimed) {
      const current = await getGameState(req.userId)
      res.json({
        ok: true,
        alreadyClaimed: true,
        rewardKey: null,
        rewardAmount: 0,
        playerRank: status.playerRank,
        rewardDayKey: status.rewardDayKey,
        message: '어제 랭킹 보상은 이미 받았어요.',
        state: current,
        ...status,
      })
      return
    }

    const current = await getGameState(req.userId)
    const state = await saveGameState(req.userId, {
      ...current,
      money: Number(current.money ?? 0) + RANKING_TOP3_REWARD_AMOUNT,
    })

    const claim = await recordPromotionClaim({
      userId: req.userId,
      claimType: RANKING_TOP3_CLAIM_TYPE,
      dayKey: status.rewardDayKey,
      rewardKey,
    })

    const payload = await attachPlayerRank(req.userId, {
      ok: true,
      alreadyClaimed: false,
      rewardKey: claim.reward_key ?? claim.rewardKey ?? rewardKey,
      rewardAmount: RANKING_TOP3_REWARD_AMOUNT,
      playerRank: status.playerRank,
      rewardDayKey: status.rewardDayKey,
      message: `토스로 ${RANKING_TOP3_REWARD_AMOUNT.toLocaleString('ko-KR')}원이 지급됐어요! 게임 상단 커피값은 오늘 적립이라 그대로일 수 있어요. 토스 앱 → 포인트에서 확인해 주세요.`,
      state,
      ...status,
      claimed: true,
      canClaim: false,
    })
    res.json(payload)
  } catch (error) {
    handleApiError(res, error)
  }
})

app.post('/api/auth/toss', requireStorage, async (req, res) => {
  const authorizationCode = String(req.body?.authorizationCode || '').trim()
  const referrer = String(req.body?.referrer || 'DEFAULT').trim()
  const deviceId = String(req.body?.deviceId || '').trim()
  const displayName = String(req.body?.displayName || '커피 농부').trim()

  const result = await exchangeTossAuthorizationCode({ authorizationCode, referrer })

  if (!result.ok) {
    res.status(result.status || 400).json(result)
    return
  }

  try {
    const profile = await resolveTossSession({
      tossUserKey: result.tossUserKey,
      displayName: result.displayName || displayName,
      deviceId,
      refreshToken: result.refreshToken,
    })
    const state = await getGameState(profile.userId)

    const payload = await attachPlayerRank(profile.userId, {
      ok: true,
      ...profile,
      state,
      balanceRules: getBalanceRules(),
    })
    res.json(payload)
  } catch (error) {
    handleApiError(res, error)
  }
})

async function handleTossUnlinkCallback(req, res) {
  if (!verifyTossUnlinkCallbackAuth(req)) {
    res.status(401).json({ ok: false, message: '인증에 실패했습니다.' })
    return
  }

  if (!isStorageReady()) {
    res.status(503).json({ ok: false, message: storageUnavailableMessage() })
    return
  }

  const userKey = String(req.body?.userKey || req.query?.userKey || '').trim()
  const referrer = String(req.body?.referrer || req.query?.referrer || '').trim()

  if (!userKey) {
    res.status(400).json({ ok: false, message: 'userKey가 필요합니다.' })
    return
  }

  try {
    const payload = await handleTossUnlink(userKey)
    console.info('Toss unlink callback', { userKey, referrer, ...payload })
    res.json({ ok: true, userKey: Number(userKey), referrer })
  } catch (error) {
    handleApiError(res, error)
  }
}

app.get('/api/auth/toss/unlink', handleTossUnlinkCallback)
app.post('/api/auth/toss/unlink', handleTossUnlinkCallback)

app.listen(PORT, () => {
  console.log(`grow-coffee-api listening on http://localhost:${PORT}`)
  console.log(`storage: ${getStorageMode()}`)

  if (!isStorageReady()) {
    console.warn(storageUnavailableMessage())
  }

  if (!isSupabaseAdminConfigured()) {
    console.warn('로컬 파일 저장소 사용 중 — data/grow-coffee-db.json (goldcat DB와 분리)')
  }

  if (!isTossMtlsConfigured()) {
    console.warn('TOSS mTLS 미설정 — 토스 로그인 불가')
  }
})
