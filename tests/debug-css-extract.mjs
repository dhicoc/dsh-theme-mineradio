// Debug: verify the theme CSS injected into the fixture page actually contains
// the preview rules and that the selectors match the fixture DOM.
import vm from 'node:vm'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const bundle = fs.readFileSync(path.join(root, 'lib/client.js'), 'utf8')
const pattern = new RegExp('\\.textContent\\s*=\\s*(`(?:[^`\\\\]|\\\\.)*`)', 'g')
const sheets = [...bundle.matchAll(pattern)].map(m => vm.runInNewContext(m[1]))
console.log('style tags:', sheets.length)
const holder = sheets.find(c => c.includes('has([data-changes-hover-preview])'))
console.log('sheet with preview rule:', Boolean(holder))
if (holder) {
  const i = holder.indexOf('has([data-changes-hover-preview])')
  console.log('--- selector context ---')
  console.log(holder.slice(Math.max(0, i - 140), i + 240))
}
