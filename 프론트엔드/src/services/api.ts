import type { GameState } from '../game/types'
import type { BalanceRules } from '../game/passiveGrowth'
import { DEFAULT_BALANCE_RULES } from '../game/passiveGrowth'

const DEVICE_ID_KEY = 'grow-coffee-device-id'
const USER_ID_KEY = 'grow-coffee-user-id'
const SESSION_SOURCE_KEY = 'grow-coffee-session-source'
const DISPLAY_NAME_KEY = 'grow-coffee-display-name'

function getApiBase() {
  const configured = import.meta.env.VITE_API_URL?.trim()
  if (configured) {
    return configured.replace(/\/$/, '')
  }

  return ''
}

export function isBackendConfigured() {
  if (import.meta.env.VITE_API_URL?.trim()) {
    return true
  }

  return import.meta.env.DEV
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

async function request(path: string, options: RequestOptions = {}) {
  const userId = getStoredUserId()
  const response = await fetch(`${getApiBase()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(userId ? { 'x-grow-coffee-user': userId } : {}),
      ...(import.meta.env.DEV ? { 'x-grow-coffee-dev': '1' } : {}),
      ...options.headers,
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
}

export type PlayerSession = {
  userId: string
  displayName: string
  source: string
  playerRank?: number | null
  state?: GameState
  balanceRules?: BalanceRules
  passiveGrowthPreview?: PassiveGrowthPreview
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

export async function drinkGame() {
  return request('/api/game/drink', { method: 'POST', body: '{}' }) as Promise<{
    ok: true
    state: GameState
    lastEarned: number | null
    passiveGrowthPreview?: PassiveGrowthPreview
    playerRank?: number | null
  }>
}

export async function watchAdGame() {
  return request('/api/game/watch-ad', { method: 'POST', body: '{}' }) as Promise<{
    ok: true
    state: GameState
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

export async function selectCoffeeVariant(slug: string) {
  return request('/api/game/select-variant', {
    method: 'POST',
    body: JSON.stringify({ slug }),
  }) as Promise<{ ok: true; state: GameState }>
}

export async function ensureGuestSession(displayName: string): Promise<PlayerSession> {
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
  }
}
