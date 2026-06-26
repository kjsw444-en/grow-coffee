import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sceneDialogueSrc = readFileSync(join(root, 'src/game/sceneDialogue.ts'), 'utf8')

assert.match(
  sceneDialogueSrc,
  /sceneDialogueForDailyRouletteNudge\(\)[\s\S]*?나를 눌러라냥~\\n1일 1룰렛을 돌려서\\n오늘의 보상을 받을수 있다냥~/,
  'daily roulette nudge copy should match product spec',
)

assert.doesNotMatch(
  sceneDialogueSrc,
  /돌릴 수 있다냥/,
  'legacy roulette nudge copy should be removed',
)

console.log('scene dialogue copy tests passed')
