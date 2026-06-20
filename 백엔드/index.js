import './loadEnv.js'
import cors from 'cors'
import express from 'express'
import { ACTION_COOLDOWN_MS } from './constants.js'
import {
  getGameState,
  getLastActionAt,
  getStorageMode,
  resolveGuestSession,
  saveGameState,
  setLastActionAt,
} from './db.js'
import { applyDrink, applyRedeem, applyReset, applyWater } from './gameLogic.js'
import { isSupabaseAdminConfigured } from './supabase.js'

const PORT = Number(process.env.PORT) || 8787
const app = express()

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
  }),
)
app.use(express.json({ limit: '64kb' }))

function getUserId(req) {
  return req.headers['x-grow-coffee-user'] || req.body?.userId || req.query?.userId
}

function requireUser(req, res, next) {
  const userId = getUserId(req)

  if (!userId) {
    res.status(401).json({ ok: false, message: 'userId가 필요합니다.' })
    return
  }

  req.userId = String(userId)
  next()
}

function handleDbError(res, error) {
  console.error(error)
  res.status(500).json({ ok: false, message: error.message || '서버 오류' })
}

function enforceActionCooldown(req, res) {
  const now = Date.now()
  const lastAction = getLastActionAt(req.userId)

  if (now - lastAction < ACTION_COOLDOWN_MS) {
    res.status(429).json({ ok: false, message: '너무 빠르게 진행했어요.' })
    return null
  }

  return now
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'grow-coffee-api',
    storage: getStorageMode(),
    supabase: isSupabaseAdminConfigured(),
  })
})

app.post('/api/auth/guest', async (req, res) => {
  const deviceId = String(req.body?.deviceId || '').trim()

  if (!deviceId) {
    res.status(400).json({ ok: false, message: 'deviceId가 필요합니다.' })
    return
  }

  try {
    const session = await resolveGuestSession(deviceId, req.body?.displayName)
    const state = await getGameState(session.userId)
    res.json({ ok: true, ...session, state })
  } catch (error) {
    handleDbError(res, error)
  }
})

app.get('/api/game/state', requireUser, async (req, res) => {
  try {
    const state = await getGameState(req.userId)
    res.json({ ok: true, state })
  } catch (error) {
    handleDbError(res, error)
  }
})

app.post('/api/game/water', requireUser, async (req, res) => {
  const now = enforceActionCooldown(req, res)
  if (now === null) return

  try {
    const current = await getGameState(req.userId)
    const result = applyWater(current)

    if (!result.ok) {
      res.status(400).json(result)
      return
    }

    const state = await saveGameState(req.userId, result.state)
    setLastActionAt(req.userId, now)

    res.json({
      ok: true,
      state,
      lastEarned: result.lastEarned,
    })
  } catch (error) {
    handleDbError(res, error)
  }
})

app.post('/api/game/drink', requireUser, async (req, res) => {
  const now = enforceActionCooldown(req, res)
  if (now === null) return

  try {
    const current = await getGameState(req.userId)
    const result = applyDrink(current)

    if (!result.ok) {
      res.status(400).json(result)
      return
    }

    const state = await saveGameState(req.userId, result.state)
    setLastActionAt(req.userId, now)

    res.json({
      ok: true,
      state,
      lastEarned: result.lastEarned,
    })
  } catch (error) {
    handleDbError(res, error)
  }
})

app.post('/api/game/redeem', requireUser, async (req, res) => {
  try {
    const current = await getGameState(req.userId)
    const result = applyRedeem(current)

    if (!result.ok) {
      res.status(400).json(result)
      return
    }

    const state = await saveGameState(req.userId, result.state)

    res.json({
      ok: true,
      state,
      rewardAmount: result.rewardAmount,
    })
  } catch (error) {
    handleDbError(res, error)
  }
})

app.post('/api/game/reset', requireUser, async (req, res) => {
  try {
    const result = applyReset()
    const state = await saveGameState(req.userId, result.state)
    setLastActionAt(req.userId, 0)
    res.json({ ok: true, state })
  } catch (error) {
    handleDbError(res, error)
  }
})

app.listen(PORT, () => {
  console.log(`grow-coffee-api listening on http://localhost:${PORT}`)
  console.log(`storage: ${getStorageMode()}`)
  if (!isSupabaseAdminConfigured()) {
    console.warn('Supabase 미설정 — 메모리 저장소로 실행 중 (재시작 시 데이터 초기화)')
  }
})
