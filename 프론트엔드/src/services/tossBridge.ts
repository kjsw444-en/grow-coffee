import { appLogin } from '@apps-in-toss/web-framework'
import {
  ensureGuestSession,
  ensureTossSession,
  fetchGameBootstrap,
  getStoredDisplayName,
  getStoredSessionSource,
  getStoredUserId,
  isBackendConfigured,
  signOutPlayer,
  type PlayerSession,
} from './api'
import { DEFAULT_BALANCE_RULES } from '../game/passiveGrowth'
import { DEFAULT_DISPLAY_NAME } from '../game/mockData'

export const TOSS_APP_NAME = 'coffeegrow'

export async function loginWithTossSession(displayName: string): Promise<PlayerSession> {
  const { authorizationCode, referrer } = await appLogin()

  return ensureTossSession({
    authorizationCode,
    referrer,
    displayName,
  })
}

export async function initPlayerSession(
  displayName = DEFAULT_DISPLAY_NAME,
): Promise<PlayerSession & {
  state?: import('../game/types').GameState
  balanceRules?: import('../game/passiveGrowth').BalanceRules
  passiveGrowthPreview?: import('./api').PassiveGrowthPreview
}> {
  const storedUserId = getStoredUserId()
  const storedSource = getStoredSessionSource()
  const storedName = getStoredDisplayName()

  if (storedUserId && storedSource) {
    if (isBackendConfigured()) {
      try {
        const bootstrap = await fetchGameBootstrap()
        return {
          userId: storedUserId,
          displayName: storedName || displayName,
          source: storedSource,
          state: bootstrap.state,
          balanceRules: bootstrap.balanceRules,
          passiveGrowthPreview: bootstrap.passiveGrowthPreview,
          playerRank: bootstrap.playerRank ?? null,
        }
      } catch (error) {
        signOutPlayer()
        try {
          return await ensureGuestSession(displayName)
        } catch (guestError) {
          const message =
            guestError instanceof Error
              ? guestError.message
              : error instanceof Error
                ? error.message
                : '게스트 세션을 만들지 못했습니다.'
          console.warn('Stored session bootstrap failed, falling back to mock session', error, guestError)
          return {
            userId: '',
            displayName: storedName || displayName,
            source: 'mock',
            balanceRules: DEFAULT_BALANCE_RULES,
            connectionError: message,
          }
        }
      }
    } else {
      return {
        userId: storedUserId,
        displayName: storedName || displayName,
        source: storedSource,
      }
    }
  }

  if (!isBackendConfigured()) {
    return {
      userId: '',
      displayName: DEFAULT_DISPLAY_NAME,
      source: 'mock',
    }
  }

  if (isTossInApp()) {
    try {
      return await loginWithTossSession(displayName)
    } catch (error) {
      console.warn('Toss login failed, falling back to guest session', error)

      if (getStoredSessionSource() === 'toss') {
        throw error
      }

      return ensureGuestSession(displayName)
    }
  }

  try {
    return await ensureGuestSession(displayName)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '게스트 세션을 만들지 못했습니다.'
    console.warn('Guest session failed, falling back to mock session', error)
    return {
      userId: '',
      displayName: DEFAULT_DISPLAY_NAME,
      source: 'mock',
      balanceRules: DEFAULT_BALANCE_RULES,
      connectionError: message,
    }
  }
}

export function isTossInApp() {
  if (typeof window === 'undefined') return false

  return (
    window.location.hostname.endsWith('.apps.tossmini.com') ||
    window.location.hostname.endsWith('.private-apps.tossmini.com')
  )
}
