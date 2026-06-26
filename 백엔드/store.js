import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const DATA_FILE = path.join(DATA_DIR, 'grow-coffee-db.json')

const DEFAULT_DB = {
  profiles: {},
  gameStates: {},
  rankings: {},
  rankingDailyEntries: {},
  promotionClaims: {},
  lastActionAt: {},
  /** Supabase ritual 컬럼 미마이그레이션 시 일일 운세 진행 상태 보조 저장 */
  ritualOverlays: {},
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf8')
  }
}

export function readLocalDb() {
  ensureDataFile()

  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    return {
      profiles: parsed.profiles ?? {},
      gameStates: parsed.gameStates ?? {},
      rankings: parsed.rankings ?? {},
      rankingDailyEntries: parsed.rankingDailyEntries ?? {},
      promotionClaims: parsed.promotionClaims ?? {},
      lastActionAt: parsed.lastActionAt ?? {},
      ritualOverlays: parsed.ritualOverlays ?? {},
    }
  } catch {
    return structuredClone(DEFAULT_DB)
  }
}

export function writeLocalDb(nextDb) {
  ensureDataFile()
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(
      {
        profiles: nextDb.profiles ?? {},
        gameStates: nextDb.gameStates ?? {},
        rankings: nextDb.rankings ?? {},
        rankingDailyEntries: nextDb.rankingDailyEntries ?? {},
        promotionClaims: nextDb.promotionClaims ?? {},
        lastActionAt: nextDb.lastActionAt ?? {},
        ritualOverlays: nextDb.ritualOverlays ?? {},
      },
      null,
      2,
    ),
    'utf8',
  )
}

export function patchLocalDb(mutator) {
  const db = readLocalDb()
  mutator(db)
  writeLocalDb(db)
  return db
}
