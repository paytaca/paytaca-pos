import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const backendRequire = createRequire(
  new URL(
    '../../../nfc-card/nfc-card-server/contract-api/package.json',
    import.meta.url
  )
)
const runner = join(
  dirname(backendRequire.resolve('vitest/package.json')),
  'vitest.mjs'
)
const result = spawnSync(
  process.execPath,
  [
    runner,
    'run',
    '--config',
    fileURLToPath(new URL('./card-backend.vitest.mjs', import.meta.url)),
  ],
  { stdio: 'inherit' }
)
process.exitCode = result.status ?? 1
