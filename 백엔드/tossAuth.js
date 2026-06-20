import { decryptTossUserInfo } from './tossDecrypt.js'
import {
  getTossAuthApiBase,
  isTossMtlsConfigured,
  tossTlsRequest,
} from './tossTlsClient.js'

function parseTossJson(raw, context) {
  let parsed

  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`${context} 응답을 해석하지 못했습니다.`)
  }

  if (parsed?.resultType === 'FAIL') {
    const reason = parsed.error?.reason || parsed.error?.errorCode || '토스 API 오류'
    throw new Error(reason)
  }

  if (parsed?.error === 'invalid_grant') {
    throw new Error('인가 코드가 만료되었거나 이미 사용됐어요.')
  }

  return parsed
}

async function requestAccessToken(authorizationCode, referrer) {
  const apiBase = getTossAuthApiBase()
  const response = await tossTlsRequest(`${apiBase}/generate-token`, {
    method: 'POST',
    body: {
      authorizationCode,
      referrer,
    },
  })

  const parsed = parseTossJson(response.data, 'AccessToken')
  const success = parsed.success

  if (!success?.accessToken) {
    throw new Error('AccessToken을 받지 못했습니다.')
  }

  return success
}

async function requestUserInfo(accessToken) {
  const apiBase = getTossAuthApiBase()
  const response = await tossTlsRequest(`${apiBase}/login-me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const parsed = parseTossJson(response.data, '사용자 정보')
  const success = parsed.success

  if (!success?.userKey) {
    throw new Error('userKey를 받지 못했습니다.')
  }

  return decryptTossUserInfo(success)
}

export async function exchangeTossAuthorizationCode({
  authorizationCode,
  referrer = 'DEFAULT',
}) {
  if (!isTossMtlsConfigured()) {
    return {
      ok: false,
      status: 501,
      message: '서버에 토스 mTLS 인증서가 설정되지 않았습니다.',
    }
  }

  const code = String(authorizationCode || '').trim()
  const safeReferrer = String(referrer || 'DEFAULT').trim()

  if (!code) {
    return {
      ok: false,
      status: 400,
      message: 'authorizationCode가 필요합니다.',
    }
  }

  if (!['DEFAULT', 'SANDBOX'].includes(safeReferrer)) {
    return {
      ok: false,
      status: 400,
      message: 'referrer 값이 올바르지 않습니다.',
    }
  }

  try {
    const token = await requestAccessToken(code, safeReferrer)
    const userInfo = await requestUserInfo(token.accessToken)
    const displayName = String(userInfo.name || '').trim().slice(0, 24) || '커피 농부'

    return {
      ok: true,
      tossUserKey: String(userInfo.userKey),
      displayName,
      refreshToken: token.refreshToken || null,
    }
  } catch (error) {
    console.error('Toss login failed:', error)
    return {
      ok: false,
      status: 502,
      message: error.message || '토스 로그인에 실패했습니다.',
    }
  }
}

export function verifyTossUnlinkCallbackAuth(req) {
  const expected = process.env.TOSS_UNLINK_CALLBACK_AUTH?.trim()

  if (!expected) {
    return true
  }

  const header = req.headers.authorization

  if (!header?.startsWith('Basic ')) {
    return false
  }

  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8')
  return decoded === expected
}
