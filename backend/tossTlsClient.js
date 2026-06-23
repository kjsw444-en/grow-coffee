import fs from 'node:fs'
import https from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function readCredential({ inline, filePath, label }) {
  if (inline?.trim()) {
    return inline.replace(/\\n/g, '\n')
  }

  if (filePath?.trim()) {
    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(__dirname, filePath)

    return fs.readFileSync(resolved, 'utf8')
  }

  throw new Error(`${label}가 설정되지 않았습니다.`)
}

function createTlsAgent() {
  const cert = readCredential({
    inline: process.env.TOSS_CLIENT_CERT,
    filePath: process.env.TOSS_CLIENT_CERT_PATH,
    label: 'TOSS_CLIENT_CERT 또는 TOSS_CLIENT_CERT_PATH',
  })
  const key = readCredential({
    inline: process.env.TOSS_CLIENT_KEY,
    filePath: process.env.TOSS_CLIENT_KEY_PATH,
    label: 'TOSS_CLIENT_KEY 또는 TOSS_CLIENT_KEY_PATH',
  })

  return new https.Agent({
    cert,
    key,
    rejectUnauthorized: true,
  })
}

let tlsAgent

function getTlsAgent() {
  if (!tlsAgent) {
    tlsAgent = createTlsAgent()
  }

  return tlsAgent
}

export function isTossMtlsConfigured() {
  const hasCert = process.env.TOSS_CLIENT_CERT?.trim() || process.env.TOSS_CLIENT_CERT_PATH?.trim()
  const hasKey = process.env.TOSS_CLIENT_KEY?.trim() || process.env.TOSS_CLIENT_KEY_PATH?.trim()
  return Boolean(hasCert && hasKey)
}

export function getTossAuthApiBase() {
  return (
    process.env.TOSS_AUTH_API_BASE?.trim() ||
    'https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/user/oauth2'
  )
}

export async function tossTlsRequest(url, { method = 'GET', body, headers = {} } = {}) {
  const urlObj = new URL(url)

  return new Promise((resolve, reject) => {
    const requestOptions = {
      agent: getTlsAgent(),
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: `${urlObj.pathname}${urlObj.search}`,
      method,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...headers,
      },
    }

    const req = https.request(requestOptions, (res) => {
      let raw = ''
      res.on('data', (chunk) => {
        raw += chunk
      })
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data: raw,
        })
      })
    })

    req.on('error', reject)

    if (body !== undefined) {
      req.write(JSON.stringify(body))
    }

    req.end()
  })
}
