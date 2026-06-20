import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const serverDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(serverDir, '..')

for (const envPath of [path.join(serverDir, '.env'), path.join(rootDir, '.env')]) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath })
  }
}
