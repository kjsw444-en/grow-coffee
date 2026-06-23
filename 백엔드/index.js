import './loadEnv.js'
import cors from 'cors'
import express from 'express'
import {
  getGameState,
  getLastActionAt,
  getProfileDisplayName,
  handleTossUnlink,
  resolveGuestSession as resolveGuestProfile,
  resolveTossSession,
  saveGameState,
  setLastActionAt,
} from './db.js'
import {
  getPlayerRank,
  getTop50Rankings,
  submitRanking,
  syncRankingFromGameState,
} from './ranking.js'
import { isSupabaseAdminConfigured } from './supabase.js'
import { getStorageMode, isStorageReady, storageUnavailableMessage } from './storagePolicy.js'
import {
  getUserId,
  handleApiError,
  isDevRequest,
  requireStorage,
  requireUser,
} from './middleware.js'
import { applyClaimPassiveCoffee, applyDrink, applyDevBumpPassive, applyDevTestWater, applyPurchaseCoffeeVariant, applyReactivatePassiveCoffee, applyReset, applySelectCoffeeVariant, applySellBatch, applyShareReward, applyWatchAd, applyWater } from './gameLogic.js'
import { ACTION_COOLDOWN_MS, SHARE_REWARD_MODULE_ID } from './constants.js'
import { getBalanceRules, previewPassiveGrowth } from './passiveGrowth.js'
import {
  exchangeTossAuthorizationCode,
  verifyTossUnlinkCallbackAuth,
} from './tossAuth.js'
import { isTossDecryptConfigured } from './tossDecrypt.js'
import { isTossMtlsConfigured } from './tossTlsClient.js'

const app = express()
const PORT = Number(process.env.PORT) || 8787

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
    const lastAction = getLastActionAt(req.userId)
    const devBypass = isDevRequest(req)

    if (!devBypass && now - lastAction < ACTION_COOLDOWN_MS) {
      const current = await getGameState(req.userId)
      res.status(429).json({
        ok: false,
        message: '잠시 후 다시 시도해 주세요.',
        state: current,
      })
      return
    }

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
    const state = await saveGameState(req.userId, { ...current, totalCoffees })
    res.json({
      ok: true,
      state,
      passiveGrowthPreview: previewPassiveGrowth(state),
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
    await syncRankingFromGameState(req.userId, state, displayName)

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
    })
    res.json(payload)
  } catch (error) {
    handleApiError(res, error)
  }
})

app.post('/api/game/sell-batch', requireUser, async (req, res) => {
  try {
    const current = await getGameState(req.userId)
    const result = applySellBatch(current)

    if (!result.ok) {
      const messages = {
        'already-redeemed': '이미 목표를 달성했어요.',
        'not-enough-cups': '판매하려면 내린 커피 10잔이 필요해요.',
      }
      res.status(400).json({
        ok: false,
        message: messages[result.reason] || '커피를 판매할 수 없어요.',
        state: result.state,
      })
      return
    }

    const state = await saveGameState(req.userId, result.state)
    const displayName = await getProfileDisplayName(req.userId)
    try {
      await syncRankingFromGameState(req.userId, state, displayName)
    } catch (rankingError) {
      console.error('ranking sync after sell-batch failed', rankingError)
    }

    const payload = await attachPlayerRank(req.userId, {
      ok: true,
      state,
      lastEarned: result.lastEarned,
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
        'not-enough-cups': '내린 커피 잔이 부족해요. (100잔 필요)',
      }
      res.status(400).json({
        ok: false,
        message: messages[result.reason] || '구매할 수 없어요.',
        state: result.state,
      })
      return
    }

    const state = await saveGameState(req.userId, result.state)
    const displayName = await getProfileDisplayName(req.userId)
    await syncRankingFromGameState(req.userId, state, displayName)

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
    const result = applyReset()
    const state = await saveGameState(req.userId, result.state)
    setLastActionAt(req.userId, 0)
    res.json({ ok: true, state })
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
  const spentCoffeeCups = Number(req.body?.spentCoffeeCups)
  const displayName = String(req.body?.displayName || '').trim()

  if (!Number.isFinite(spentCoffeeCups) || spentCoffeeCups < 0) {
    res.status(400).json({ ok: false, message: 'spentCoffeeCups 값이 올바르지 않습니다.' })
    return
  }

  try {
    const current = await getGameState(req.userId)
    const safeScore = Math.max(
      Math.floor(spentCoffeeCups),
      Math.floor(Number(current.spentCoffeeCups ?? 0)),
    )
    const safeName = displayName || (await getProfileDisplayName(req.userId))
    const payload = await submitRanking(req.userId, safeScore, safeName)
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
