import assert from 'node:assert/strict'

const BASE = process.env.RITUAL_API_BASE || 'http://localhost:8787'

async function request(path, { method = 'GET', userId, body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(userId ? { 'x-grow-coffee-user': userId } : {}),
    },
    body: body == null ? undefined : JSON.stringify(body),
  })

  const json = await response.json().catch(() => ({}))
  return { status: response.status, json }
}

function test(name, fn) {
  return fn().then(
    () => console.log(`ok - ${name}`),
    (error) => {
      console.error(`fail - ${name}`)
      throw error
    },
  )
}

const deviceId = `ritual-api-test-${Date.now()}`

await test('guest auth + game state includes ritual fields', async () => {
  const guest = await request('/api/auth/guest', {
    method: 'POST',
    body: { deviceId, displayName: '운세테스트' },
  })
  assert.equal(guest.status, 200)
  assert.ok(guest.json.userId)

  const userId = guest.json.userId
  const stateRes = await request('/api/game/state', { userId })
  assert.equal(stateRes.status, 200)
  assert.ok(stateRes.json.state.ritualFortuneId)
  assert.ok(stateRes.json.state.ritualGiftId)
  assert.equal(stateRes.json.state.ritualFortuneRevealed, false)
})

await test('ritual today + reveal + gift + mission claim flow', async () => {
  const guest = await request('/api/auth/guest', {
    method: 'POST',
    body: { deviceId: `${deviceId}-flow`, displayName: '운세플로우' },
  })
  const userId = guest.json.userId

  const today = await request('/api/ritual/today', { userId })
  assert.equal(today.status, 200)
  assert.ok(today.json.ritual.fortune.id)
  assert.equal(today.json.ritual.fortune.revealed, false)

  const reveal = await request('/api/ritual/fortune/reveal', { method: 'POST', userId, body: {} })
  assert.equal(reveal.status, 200)
  assert.equal(reveal.json.state.ritualFortuneRevealed, true)
  assert.ok(reveal.json.copy)

  const gift = await request('/api/ritual/gift/open', { method: 'POST', userId, body: {} })
  assert.equal(gift.status, 200)
  assert.equal(gift.json.state.ritualGiftOpened, true)
  assert.equal(gift.json.ritual.ritualComplete, true)

  const repeatReveal = await request('/api/ritual/fortune/reveal', { method: 'POST', userId, body: {} })
  assert.equal(repeatReveal.status, 400)
})

console.log('test-ritual-api: all passed')
