const base = 'http://localhost:8787'

async function post(path, body, headers = {}) {
  const started = Date.now()
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-grow-coffee-dev': '1',
      ...headers,
    },
    body: JSON.stringify(body ?? {}),
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text }
  }
  console.log(`${path} -> ${res.status} in ${Date.now() - started}ms`)
  if (!res.ok) {
    console.log(json)
    throw new Error(`${path} failed`)
  }
  return json
}

const guest = await post('/api/auth/guest', {
  deviceId: `test-${Date.now()}`,
  displayName: '테스트',
})
const userId = guest.userId
console.log('userId', userId)

await post('/api/game/dev/bump-passive', {}, { 'x-grow-coffee-user': userId })

const claim = await post('/api/game/claim-passive-coffee', {}, { 'x-grow-coffee-user': userId })
console.log('claimed', claim.state.passiveCoffeesClaimed, 'total', claim.state.totalCoffees)
