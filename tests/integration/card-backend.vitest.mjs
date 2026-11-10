import { fileURLToPath } from 'node:url'

// Explicit isolated configuration: never load either application's environment.
export default {
  root: fileURLToPath(new URL('../../', import.meta.url)),
  test: {
    globals: true,
    include: ['tests/integration/card-backend-compatibility.test.mjs'],
    setupFiles: [
      fileURLToPath(
        new URL(
          '../../../nfc-card/nfc-card-server/contract-api/test/setup.js',
          import.meta.url
        )
      ),
    ],
    maxWorkers: 1,
  },
}
