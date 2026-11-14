// Probe which relative imports esbuild can resolve in this environment.
import es from 'esbuild'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const resolveDir = path.join(root, 'src', 'client')

async function probe(name, contents) {
  try {
    const result = await es.build({
      stdin: { contents, loader: 'ts', resolveDir },
      bundle: true, write: false, format: 'iife',
      external: ['@deepseek-ai/*', 'react', 'react/jsx-runtime'],
    })
    console.log(`OK   ${name} (${result.outputFiles[0].text.length}b)`)
  } catch (e) {
    const lines = e.message.split('\n').filter(l => l.includes('ERROR')).slice(0, 2)
    console.log(`FAIL ${name}: ${lines.join(' | ')}`)
  }
}

for (const file of ['station-dial.ts', 'spot-core.ts', 'surface-audit.ts', 'theme-layer.ts', 'role-census.ts', 'whale.ts']) {
  await probe(file, readFileSync(path.join(resolveDir, file), 'utf8'))
}
await probe('one-line-import surface-audit', `export * from './surface-audit.ts'`)
await probe('one-line-import whale', `export * from './whale.ts'`)
await probe('one-line-import MineradioPluginCard', `export * from './MineradioPluginCard.tsx'`)
