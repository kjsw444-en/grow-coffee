import type { GameState } from '../game/types'
import type { BalanceRules } from '../game/passiveGrowth'
import { DEFAULT_BALANCE_RULES } from '../game/passiveGrowth'

const DEVICE_ID_KEY = 'grow-coffee-device-id'
const USER_ID_KEY = 'grow-coffee-user-id'
const SESSION_SOURCE_KEY = 'grow-coffee-session-source'
const DISPLAY_NAME_KEY = 'grow-coffee-display-name'

const VITE_DEV_PORTS = new Set(['5173', '5174', '4173'])

function getDevBackendBase() {
  return 'http://127.0.0.1:8787'
}

export function getApiBase() {
  const configured = import.meta.env.VITE_API_URL?.trim()
  if (configured) {
    return configured.replace(/\/$/, '')
  }

  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const { hostname, port } = window.location
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1'

    // Vite dev(5173 등): 같은 출처 /api → vite proxy → 8787 (CORS·PNA 문제 없음)
    if (isLocalHost && VITE_DEV_PORTS.has(port)) {
      return ''
    }

    // Granite shell(8081) 등: 백엔드 직접 연결
    if (isLocalHost) {
      return getDevBackendBase()
    }
  }

  return ''
}

export function getApiBaseForDebug() {
  return getApiBase() || `${typeof window !== 'undefined' ? window.location.origin : ''}/api (proxy)`
}

export async function fetchBackendHealth(timeoutMs = 3000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  const base = getApiBase()
  const url = base ? `${base}/api/health` : '/api/health'

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: import.meta.env.DEV ? { 'x-grow-coffee-dev': '1' } : {},
    })
    if (!response.ok) {
      throw new Error(`백엔드 health ${response.status}`)
    }
    return (await response.json()) as { ok: boolean }
  } finally {
    clearTimeout(timeoutId)
  }
}

export function isBackendConfigured() {
  if (import.meta.env.VITE_API_URL?.trim()) {
    return true
  }

  return import.meta.env.DEV
}

export function getServerUnavailableMessage() {
  return import.meta.env.DEV
    ? '백엔드 서버를 실행해 주세요.'
    : '서버에 연결할 수 없어요. 앱을 다시 열어 주세요.'
}

export function getDeviceId() {
  const existing = localStorage.getItem(DEVICE_ID_KEY)

  if (existing) {
    return existing
  }

  const nextId = crypto.randomUUID()
  localStorage.setItem(DEVICE_ID_KEY, nextId)
  return nextId
}

export function getStoredUserId() {
  return localStorage.getItem(USER_ID_KEY) || ''
}

export function setStoredUserId(userId: string) {
  if (userId) {
    localStorage.setItem(USER_ID_KEY, userId)
    return
  }

  localStorage.removeItem(USER_ID_KEY)
}

export function getStoredSessionSource() {
  return localStorage.getItem(SESSION_SOURCE_KEY) || ''
}

export function setStoredSessionSource(source: string) {
  if (source) {
    localStorage.setItem(SESSION_SOURCE_KEY, source)
    return
  }

  localStorage.removeItem(SESSION_SOURCE_KEY)
}

export function getStoredDisplayName() {
  return localStorage.getItem(DISPLAY_NAME_KEY) || ''
}

export function setStoredDisplayName(name: string) {
  if (name) {
    localStorage.setItem(DISPLAY_NAME_KEY, name)
    return
  }

  localStorage.removeItem(DISPLAY_NAME_KEY)
}

export function signOutPlayer() {
  setStoredUserId('')
  setStoredSessionSource('')
  setStoredDisplayName('')
}

type RequestOptions = RequestInit & {
  headers?: Record<string, string>
  timeoutMs?: number
}

export class ApiRequestError extends Error {
  state?: GameState
  status?: number

  constructor(message: string, state?: GameState, status?: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.state = state
    this.status = status
  }
}

async function performRequest(path: string, options: RequestOptions = {}) {
  const { headers, timeoutMs = 20000, ...fetchOptions } = options
  const userId = getStoredUserId()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${getApiBase()}${path}`, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'x-grow-coffee-user': userId } : {}),
        ...(import.meta.env.DEV ? { 'x-grow-coffee-dev': '1' } : {}),
        ...headers,
      },
    })

    const body = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new ApiRequestError(body.message || `API ${response.status}`, body.state, response.status)
    }

    if (body.ok === false) {
      throw new ApiRequestError(body.message || '요청에 실패했습니다.', body.state, response.status)
    }

    return body
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiRequestError('서버 응답 시간이 초과됐어요. 잠시 후 다시 시도해 주세요.')
    }
    if (error instanceof TypeError || (error instanceof Error && error.message === 'Failed to fetch')) {
      throw new ApiRequestError(
        import.meta.env.DEV
          ? '백엔드(8787)에 연결되지 않아요. 백엔드 npm run dev 실행 후 Ctrl+Shift+R 새로고침해 주세요.'
          : '서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.',
      )
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

async function request(path: string, options: RequestOptions = {}) {
  return performRequest(path, options)
}

export type RankingEntry = {
  id: string
  name: string
  spentCoffeeCups: number
  rank: number
  isPlayer: boolean
}

export type CoffeeRankingPayload = {
  top50: RankingEntry[]
  playerRank: number
  playerSpentCoffeeCups: number
  inTop50: boolean
  totalPlayers: number
  dayKey?: string
}

export type PlayerSession = {
  userId: string
  displayName: string
  source: string
  playerRank?: number | null
  state?: GameState
  balanceRules?: BalanceRules
  passiveGrowthPreview?: PassiveGrowthPreview
  connectionError?: string
}

export type PassiveGrowthPreview = {
  delta: number
  projectedGrowth: number
  canAccrue?: boolean
}

export type GameBootstrap = {
  state: GameState
  balanceRules: BalanceRules
  passiveGrowthPreview?: PassiveGrowthPreview
  playerRank?: number | null
}

export async function fetchGameBootstrap(): Promise<GameBootstrap> {
  const body = await request('/api/game/state')
  return {
    state: body.state,
    balanceRules: body.balanceRules ?? DEFAULT_BALANCE_RULES,
    passiveGrowthPreview: body.passiveGrowthPreview,
    playerRank: body.playerRank ?? null,
  }
}

export async function fetchGameState(): Promise<GameState> {
  const bootstrap = await fetchGameBootstrap()
  return bootstrap.state
}

export async function waterGame() {
  return request('/api/game/water', { method: 'POST', body: '{}' }) as Promise<{
    ok: true
    state: GameState
    lastEarned: number | null
    passiveGrowthPreview?: PassiveGrowthPreview
  }>
}

export async function testBumpGame() {
  try {
    return await devTestBumpGame()
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) {
      return waterGame()
    }
    throw err
  }
}

export async function devTestBumpGame() {
  return request('/api/game/dev/bump', { method: 'POST', body: '{}' }) as Promise<{
    ok: true
    state: GameState
    lastEarned: number | null
    passiveGrowthPreview?: PassiveGrowthPreview
  }>
}

export async function devBumpPassiveGame() {
  return request('/api/game/dev/bump-passive', { method: 'POST', body: '{}' }) as Promise<{
    ok: true
    state: GameState
    passiveGrowthPreview?: PassiveGrowthPreview
  }>
}

/** DEV 전용 — 내린 커피(totalCoffees) 잔 수 설정 */
export async function devSetTotalCoffees(totalCoffees: number) {
  return request('/api/game/dev/set-coffees', {
    method: 'POST',
    body: JSON.stringify({ totalCoffees }),
  }) as Promise<{
    ok: true
    state: GameState
    passiveGrowthPreview?: PassiveGrowthPreview
  }>
}

/** DEV 전용 — 마신 커피(spentCoffeeCups) 잔 수 설정 */
export async function devSetSpentCoffeeCups(spentCoffeeCups: number) {
  return request('/api/game/dev/set-drunk-coffees', {
    method: 'POST',
    body: JSON.stringify({ spentCoffeeCups }),
  }) as Promise<{
    ok: true
    state: GameState
    passiveGrowthPreview?: PassiveGrowthPreview
  }>
}

/** DEV 전용 — 접속 룰렛 수령 상태 초기화 */
export async function devResetDailyLoginRouletteGame() {
  return request('/api/game/dev/reset-daily-roulette', {
    method: 'POST',
    body: '{}',
  }) as Promise<{
    ok: true
    state: GameState
    passiveGrowthPreview?: PassiveGrowthPreview
  }>
}

/** DEV 전용 — 어제 랭킹 TOP3 토스 지급 기록 초기화 */
export async function devResetRankingTop3Promotion() {
  return request('/api/game/dev/reset-ranking-top3-promotion', {
    method: 'POST',
    body: '{}',
  }) as Promise<{ ok: true; rewardDayKey: string }>
}

/** DEV 전용 — 오늘 랭킹을 어제 마감 랭킹으로 즉시 확정 */
export async function devFinalizeRankingNow() {
  return request('/api/game/dev/finalize-ranking', {
    method: 'POST',
    body: '{}',
  }) as Promise<{
    ok: true
    finalizedDayKey: string
    sourceDayKey: string
    entryCount: number
    rewardStatus: RankingTop3RewardStatus
  }>
}

/** DEV 전용 — 오늘의 커피 운세 초기화 */
export async function devResetDailyRitualGame() {
  return request('/api/game/dev/reset-daily-ritual', {
    method: 'POST',
    body: '{}',
  }) as Promise<{
    ok: true
    state: GameState
    ritual: import('./dailyRitual').RitualTodayView
  }>
}

/** DEV 전용 — 오늘의 커피 운세 종류 지정 */
export async function devSetDailyRitualFortuneGame(fortuneId: string) {
  return request('/api/game/dev/set-daily-ritual-fortune', {
    method: 'POST',
    body: JSON.stringify({ fortuneId }),
  }) as Promise<{
    ok: true
    state: GameState
    fortuneId: string
    ritual: import('./dailyRitual').RitualTodayView
  }>
}

/** DEV 전용 — 오늘의 미션 1개 즉시 완료 */
export async function devCompleteDailyRitualMissionGame(
  mission: 'harvest' | 'minigame' | 'roulette',
) {
  return request('/api/game/dev/complete-daily-ritual-mission', {
    method: 'POST',
    body: JSON.stringify({ mission }),
  }) as Promise<{
    ok: true
    state: GameState
    missionKind: string
    ritual: import('./dailyRitual').RitualTodayView
  }>
}

/** DEV 전용 — 운세 확인·선물 열기 단계 건너뛰기 */
export async function devAdvanceDailyRitualGame(step: 'reveal' | 'gift') {
  return request('/api/game/dev/advance-daily-ritual', {
    method: 'POST',
    body: JSON.stringify({ step }),
  }) as Promise<{
    ok: true
    state: GameState
    step: string
    copy: string | null
    ritual: import('./dailyRitual').RitualTodayView
  }>
}

export async function drinkGame() {
  return request('/api/game/drink', { method: 'POST', body: '{}' }) as Promise<{
    ok: true
    state: GameState
    lastEarned: number | null
    passiveGrowthPreview?: PassiveGrowthPreview
    playerRank?: number | null
    attendanceGoalJustMet?: boolean
  }>
}

export async function claimAttendanceDailyReward() {
  return request('/api/game/claim-attendance-daily', { method: 'POST', body: '{}' }) as Promise<{
    ok: true
    state: GameState
    rewardCups: number
    passiveGrowthPreview?: PassiveGrowthPreview
    playerRank?: number | null
  }>
}

export async function claimAttendanceStreakBonus() {
  return request('/api/game/claim-attendance-streak', { method: 'POST', body: '{}' }) as Promise<{
    ok: true
    state: GameState
    rewardCups: number
    passiveGrowthPreview?: PassiveGrowthPreview
    playerRank?: number | null
  }>
}

export async function sellCoffeeBatch(cupCount: number) {
  try {
    return (await request('/api/game/sell-batch', {
      method: 'POST',
      body: JSON.stringify({ cupCount }),
    })) as Promise<{
      ok: true
      state: GameState
      lastEarned: number | null
      dailyCapJustReached?: boolean
      passiveGrowthPreview?: PassiveGrowthPreview
      playerRank?: number | null
    }>
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) {
      throw new ApiRequestError(
        '내린 커피 마시기 API가 서버에 없어요. 백엔드를 최신 버전으로 배포했는지 확인해 주세요.',
        err.state,
        404,
      )
    }
    throw err
  }
}

export async function claimDailyLoginRouletteGame() {
  return request('/api/game/daily-login-roulette', {
    method: 'POST',
    body: '{}',
  }) as Promise<{
    ok: true
    state: GameState
    rewardCups: number
    bonusSpin?: boolean
    playerRank?: number | null
    passiveGrowthPreview?: PassiveGrowthPreview
  }>
}

export async function fetchRitualToday() {
  return request('/api/ritual/today') as Promise<{
    ok: true
    state: GameState
    ritual: import('./dailyRitual').RitualTodayView
  }>
}

export async function revealRitualFortuneGame() {
  return request('/api/ritual/fortune/reveal', { method: 'POST', body: '{}' }) as Promise<{
    ok: true
    state: GameState
    fortuneId: string
    copy: string
    ritual: import('./dailyRitual').RitualTodayView
  }>
}

export async function openRitualGiftGame() {
  return request('/api/ritual/gift/open', { method: 'POST', body: '{}' }) as Promise<{
    ok: true
    state: GameState
    giftId: string
    label: string
    copy: string
    ritual: import('./dailyRitual').RitualTodayView
    playerRank?: number | null
  }>
}

export async function claimRitualFortuneRewardGame() {
  return request('/api/ritual/fortune/claim', { method: 'POST', body: '{}' }) as Promise<{
    ok: true
    state: GameState
    rewardCups: number
    ritual: import('./dailyRitual').RitualTodayView
  }>
}

export async function claimRitualMissionRewardGame() {
  return request('/api/ritual/missions/claim', { method: 'POST', body: '{}' }) as Promise<{
    ok: true
    state: GameState
    rewardCups: number
    ritual: import('./dailyRitual').RitualTodayView
  }>
}

export async function respinDailyLoginRouletteGame(previousRewardCups: number, dateKey: string) {
  return request('/api/game/daily-login-roulette/respin', {
    method: 'POST',
    body: JSON.stringify({ previousRewardCups, dateKey }),
  }) as Promise<{
    ok: true
    state: GameState
    rewardCups: number
    previousRewardCups: number
    playerRank?: number | null
    passiveGrowthPreview?: PassiveGrowthPreview
  }>
}

export async function claimMinigameReward(missionKey: string, rewardSlot: 'free' | 'ad' = 'free') {
  return request('/api/game/minigame-reward', {
    method: 'POST',
    body: JSON.stringify({ missionKey, rewardSlot }),
  }) as Promise<{
    ok: true
    state: GameState
    rewardCups: number
    playerRank?: number | null
    passiveGrowthPreview?: PassiveGrowthPreview
  }>
}

export async function claimBrewedCoffeeFinishBonusGame() {
  return request('/api/game/brewed-coffee-finish-bonus', {
    method: 'POST',
    body: '{}',
  }) as Promise<{
    ok: true
    state: GameState
    rewardCups: number
    playerRank?: number | null
    passiveGrowthPreview?: PassiveGrowthPreview
  }>
}

export async function watchAdGame() {
  return request('/api/game/watch-ad', { method: 'POST', body: '{}' }) as Promise<{
    ok: true
    state: GameState
  }>
}

export async function claimShareRewardGame(moduleId = '') {
  return request('/api/game/share-reward', {
    method: 'POST',
    body: JSON.stringify({ moduleId }),
  }) as Promise<{
    ok: true
    state: GameState
    rewardAmount: number
    passiveGrowthPreview?: PassiveGrowthPreview
    playerRank?: number | null
  }>
}

export async function claimPassiveCoffeeGame() {
  return request('/api/game/claim-passive-coffee', {
    method: 'POST',
    body: '{}',
    timeoutMs: 10000,
  }) as Promise<{
    ok: true
    state: GameState
    lastEarned: number | null
    passiveGrowthPreview?: PassiveGrowthPreview
    playerRank?: number | null
  }>
}

export async function reactivatePassiveCoffeeGame() {
  return request('/api/game/reactivate-passive-coffee', { method: 'POST', body: '{}' }) as Promise<{
    ok: true
    state: GameState
    passiveGrowthPreview?: PassiveGrowthPreview
    playerRank?: number | null
  }>
}

export async function resetGame() {
  return request('/api/game/reset', {
    method: 'POST',
    body: '{}',
  }) as Promise<{ ok: true; state: GameState }>
}

export async function purchaseCoffeeVariant(slug: string) {
  return request('/api/game/purchase-variant', {
    method: 'POST',
    body: JSON.stringify({ slug }),
  }) as Promise<{ ok: true; state: GameState; playerRank?: number | null }>
}

export async function fetchTopRanking() {
  return request('/api/ranking/top50') as Promise<{
    ok: true
    top50: RankingEntry[]
    totalPlayers: number
    dayKey?: string
    updatedAt: number
  }>
}

export async function submitCoffeeRanking({
  spentCoffeeCups,
  displayName,
}: {
  spentCoffeeCups: number
  displayName: string
}) {
  return request('/api/ranking/submit', {
    method: 'POST',
    body: JSON.stringify({ spentCoffeeCups, displayName }),
  }) as Promise<{ ok: true } & CoffeeRankingPayload>
}

export type RankingTop3RewardStatus = {
  rewardDayKey: string
  playerRank: number | null
  eligible: boolean
  claimed: boolean
  canClaim: boolean
}

export async function fetchRankingTop3PromotionStatus() {
  return request('/api/promotion/ranking-top3/status') as Promise<{ ok: true } & RankingTop3RewardStatus>
}

export async function recordRankingTop3PromotionClaim(rewardKey: string) {
  return request('/api/promotion/ranking-top3/claim', {
    method: 'POST',
    body: JSON.stringify({ rewardKey }),
  }) as Promise<{
    ok: true
    alreadyClaimed: boolean
    rewardKey: string | null
    rewardAmount: number
    playerRank: number
    rewardDayKey: string
    message: string
    state: GameState
    eligible: boolean
    claimed: boolean
    canClaim: boolean
    passiveGrowthPreview?: PassiveGrowthPreview
  }>
}

export async function selectCoffeeVariant(slug: string) {
  return request('/api/game/select-variant', {
    method: 'POST',
    body: JSON.stringify({ slug }),
  }) as Promise<{ ok: true; state: GameState }>
}

let inflightGuestSession: Promise<PlayerSession> | null = null

export async function ensureGuestSession(displayName: string): Promise<PlayerSession> {
  if (inflightGuestSession) {
    return inflightGuestSession
  }

  inflightGuestSession = (async () => {
    const body = await request('/api/auth/guest', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: getDeviceId(),
        displayName,
      }),
    })

    setStoredUserId(body.userId)
    setStoredSessionSource(body.source)
    setStoredDisplayName(body.displayName)

    return {
      userId: body.userId,
      displayName: body.displayName,
      source: body.source,
      state: body.state,
      playerRank: body.playerRank ?? null,
      balanceRules: body.balanceRules ?? DEFAULT_BALANCE_RULES,
      passiveGrowthPreview: body.passiveGrowthPreview,
    }
  })()

  try {
    return await inflightGuestSession
  } finally {
    inflightGuestSession = null
  }
}

export async function ensureTossSession({
  authorizationCode,
  referrer,
  displayName,
}: {
  authorizationCode: string
  referrer: string
  displayName: string
}): Promise<PlayerSession> {
  const body = await request('/api/auth/toss', {
    method: 'POST',
    body: JSON.stringify({
      authorizationCode,
      referrer,
      deviceId: getDeviceId(),
      displayName,
    }),
  })

  setStoredUserId(body.userId)
  setStoredSessionSource(body.source)
  setStoredDisplayName(body.displayName)

  return {
    userId: body.userId,
    displayName: body.displayName,
    source: body.source,
    state: body.state,
    playerRank: body.playerRank ?? null,
    balanceRules: body.balanceRules ?? DEFAULT_BALANCE_RULES,
    passiveGrowthPreview: body.passiveGrowthPreview,
  }
}
