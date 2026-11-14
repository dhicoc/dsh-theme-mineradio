// One-off in-process esbuild invocation: the standalone esbuild binary fails to
// resolve/write while the JS library with write:false succeeds inside this Node
// process. Replicates build-client.mjs steps and writes outputs from Node.
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash as nodeHash } from 'node:crypto'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const require = createRequire(path.join(root, 'package.json'))
const esbuild = require(path.join(root, 'build-tools', 'node_modules', 'esbuild'))
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const PLUGIN_ID = pkg.name

function createHash(s) {
  // md5 hex, first 8 chars — replicate build-client.mjs hash()
  return nodeHash('md5').update(s).digest('hex').slice(0, 8)
}

async function main() {
  const core = await esbuild.build({
    absWorkingDir: root,
    entryPoints: ['src/client/index.ts'],
    bundle: true,
    format: 'cjs',
    platform: 'browser',
    target: 'es2020',
    jsx: 'automatic',
    minify: true,
    legalComments: 'none',
    plugins: [],
    define: { 'process.env.NODE_ENV': '"production"' },
    write: false,
    outfile: undefined,
  })
  mkdirSync(path.join(root, 'lib'), { recursive: true })
  const coreText = core.outputFiles[0].text
  const wrapped = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(PLUGIN_ID)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    var previousRequire = globalThis.__dshRequire;
    globalThis.__dshRequire = require;
    try {
${coreText}
      return module.exports;
    } finally {
      globalThis.__dshRequire = previousRequire;
    }
  }
});
`
  writeFileSync(path.join(root, 'lib', 'client.js'), wrapped)

  for (const [src, out] of [['src/index.ts', 'index.js'], ['src/invariant.ts', 'invariant.js']]) {
    const result = await esbuild.build({
      absWorkingDir: root,
      entryPoints: [src],
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'es2020',
      write: false,
      define: { 'process.env.NODE_ENV': '"production"' },
    })
    writeFileSync(path.join(root, 'lib', out), result.outputFiles[0].text)
  }
  console.log('built lib/client.js, lib/index.js, lib/invariant.js (in-memory esbuild)')
}

await main().catch((err) => { console.error(err); process.exit(1) })
