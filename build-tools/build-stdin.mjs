// Builds the shipped client bundle in this environment where the esbuild child
// binary cannot enumerate directories (verified: "Cannot read directory .../
// src/client: Access is denied" for every relative-import resolution, while
// Node/PowerShell read the same tree fine and stdin entries with no relative
// imports succeed). A resolver plugin supplies every relative import through
// Node fs, bypassing esbuild's directory walk entirely. Output semantics match
// build-client.mjs: CSS modules -> hashed class map + <style> injection, DSH
// runtime + React external, CJS registry-body wrapped in __ModuleLoader__.
import es from 'esbuild'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const PLUGIN_ID = pkg.name

const hash = (s) => createHash('md5').update(s).digest('hex').slice(0, 8)

const minifyCss = (css) => css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ')
  .replace(/\s*([{}:;,])\s*/g, '$1')
  .trim()

/** Build one CSS module into the hashed class map + <style> injection JS. */
function cssModuleJs(file) {
  const source = readFileSync(file, 'utf8')
  const rel = path.relative(root, file).split(path.sep).join('/')
  const prefix = path.basename(file, '.module.css').replace(/[^a-zA-Z0-9_]/g, '_')
  const tagId = `${PLUGIN_ID}/${rel}?v=${hash(rel)}`
  const sanitized = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\[[^\]]*\]/g, '[]')
    .replace(/"[^"]*"/g, '""')
    .replace(/'[^']*'/g, "''")
  const names = new Set()
  for (const m of sanitized.matchAll(/\.([_a-zA-Z][\w-]*)/g)) {
    if (!/^(:{1,2}[a-z]|hover|active|focus|before|after|not|is|where|has|nth|first|last|child|empty|root)[\w-]*$/i.test(m[1])) names.add(m[1])
  }
  const map = {}
  let out = source
  for (const cls of names) {
    const hashed = `${prefix}_${cls}`
    map[cls] = hashed
    out = out.replace(new RegExp(`\\.${cls}(?![\\w-])`, 'g'), `.${hashed}`)
  }
  const css = minifyCss(out)
  return `
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(${JSON.stringify(tagId)}) + "]") === null) {
  const tag = document.createElement("style");
  tag.dataset.plugin = ${JSON.stringify(PLUGIN_ID)};
  tag.dataset.pluginCss = ${JSON.stringify(tagId)};
  tag.textContent = ${JSON.stringify(css)};
  document.head.appendChild(tag);
}
export default ${JSON.stringify(map)};
`
}

/**
 * Resolve a relative import by hand and feed the file content to esbuild,
 * bypassing the child binary's broken directory enumeration. For stdin
 * entries the importer is the placeholder `<stdin>`, so anchor on the
 * declared resolveDir instead of its dirname.
 */
const relativeResolver = {
  name: 'dsh-relative-resolver',
  setup(buildCtx) {
    buildCtx.onResolve({ filter: /^\.\.?\// }, (args) => {
      const isStdin = args.importer === '<stdin>' || args.importer.startsWith('<stdin>')
      const baseDir = isStdin
        ? (args.resolveDir && args.resolveDir !== '' ? args.resolveDir : path.join(root, 'src', 'client'))
        : path.dirname(args.importer)
      const resolved = path.normalize(path.join(baseDir, args.path))
      if (resolved.endsWith('.module.css')) return { path: resolved, namespace: 'css-modules-contents' }
      return { path: resolved, namespace: 'fs-contents' }
    })
    buildCtx.onLoad({ filter: /\.module\.css$/, namespace: 'css-modules-contents' }, (args) => ({
      contents: cssModuleJs(args.path),
      loader: 'js',
      resolveDir: path.dirname(args.path),
    }))
    buildCtx.onLoad({ filter: /.*/, namespace: 'fs-contents' }, (args) => {
      const file = args.path
      if (!existsSync(file)) return { errors: [{ text: `resolved path missing: ${file}` }] }
      const ext = path.extname(file)
      const loader = ext === '.tsx' ? 'tsx' : ext === '.ts' ? 'ts' : 'text'
      return { contents: readFileSync(file, 'utf8'), loader, resolveDir: path.dirname(file) }
    })
  },
}

const externalize = {
  name: 'dsh-externalize',
  setup(buildCtx) {
    buildCtx.onResolve({ filter: /^(@deepseek-ai\/.*|react$|react\/jsx-runtime)$/ }, (args) => ({ path: args.path, external: true }))
  },
}

const clientOptions = {
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  minify: true,
  legalComments: 'none',
  plugins: [relativeResolver, externalize],
  define: { 'process.env.NODE_ENV': '"production"' },
  write: false,
}

async function buildClient() {
  const core = await es.build({
    ...clientOptions,
    stdin: { contents: readFileSync(path.join(root, 'src/client/index.ts'), 'utf8'), loader: 'ts', resolveDir: path.join(root, 'src', 'client') },
  })
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
  mkdirSync(path.join(root, 'lib'), { recursive: true })
  writeFileSync(path.join(root, 'lib', 'client.js'), wrapped)
}

async function buildNodeFace([src, out]) {
  const result = await es.build({
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'es2020',
    plugins: [relativeResolver, externalize],
    define: { 'process.env.NODE_ENV': '"production"' },
    write: false,
    stdin: { contents: readFileSync(path.join(root, src), 'utf8'), loader: 'ts', resolveDir: path.dirname(path.join(root, src)) },
  })
  writeFileSync(path.join(root, 'lib', out), result.outputFiles[0].text)
}

await buildClient()
await buildNodeFace(['src/index.ts', 'index.js'])
await buildNodeFace(['src/invariant.ts', 'invariant.js'])
console.log('built lib/client.js, lib/index.js, lib/invariant.js (resolver-plugin mode)')
