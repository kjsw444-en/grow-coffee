import { isStorageReady, storageUnavailableMessage } from './storagePolicy.js'

export function getUserId(req) {
  return String(
    req.headers['x-grow-coffee-user'] || req.body?.userId || req.query?.userId || '',
  ).trim()
}

export function requireUser(req, res, next) {
  const userId = getUserId(req)

  if (!userId) {
    res.status(401).json({ ok: false, message: 'userId가 필요합니다.' })
    return
  }

  req.userId = userId
  next()
}

export function requireStorage(req, res, next) {
  if (!isStorageReady()) {
    res.status(503).json({ ok: false, message: storageUnavailableMessage() })
    return
  }

  next()
}

export function handleApiError(res, error) {
  console.error(error)
  res.status(500).json({ ok: false, message: error.message || '서버 오류' })
}

export function isDevRequest(req) {
  return req.headers['x-grow-coffee-dev'] === '1' || process.env.NODE_ENV !== 'production'
}
