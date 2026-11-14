import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'outputs/issue-12-station')
fs.mkdirSync(out, { recursive: true })
const baseline = process.argv.includes('--baseline')
const source = baseline ? execFileSync('git', ['show', '13f1b892e4e557bb1459d8afbfd0ba67e76ec221:src/client/station-dial.ts'], { cwd: root, encoding: 'utf8' }) : fs.readFileSync(path.join(root, 'src/client/station-dial.ts'), 'utf8')
const compiled = await build({ stdin: { contents: source, loader: 'ts', resolveDir: root }, bundle: true, format: 'iife', globalName: 'Station', write: false })
const html = `<!doctype html><html><body>
<div data-dsh-wordmark></div><aside>
<div role="treeitem" class="projectRow"><span class="projectText">alpha</span></div>
<div role="treeitem" aria-selected="true" id="a">session a</div>
<div role="treeitem" class="projectRow"><span class="projectText">beta</span></div>
<div role="treeitem" aria-selected="false" id="b">session b</div>
</aside><main id="chat"></main><script>${compiled.outputFiles[0].text}</script><script>
window.matchMedia = () => ({ matches: true });
window.treeScans = 0; window.offsets = [];
const query = document.querySelectorAll.bind(document);
document.querySelectorAll = selector => { if (selector.includes('treeitem')) treeScans++; return query(selector); };
window.stopDial = Station.startStationDial(value => offsets.push(value));
window.settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
</script></body></html>`
const page = path.join(out, 'station.html')
fs.writeFileSync(page, html)
const profile = fs.mkdtempSync(path.join(out, 'chrome-'))
const browser = spawn(process.env.CHROME_BIN ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', pathToFileURL(page).href], { stdio: 'ignore', windowsHide: true })
let ws
try {
  let port
  for (let i = 0; i < 100; i++) {
    try { port = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; break } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert(port, 'browser debugging endpoint available')
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  let id = 0
  const pending = new Map()
  ws.onmessage = event => {
    const msg = JSON.parse(event.data)
    const p = pending.get(msg.id)
    if (!p) return
    pending.delete(msg.id)
    msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result)
  }
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const seq = ++id; pending.set(seq, { resolve, reject }); ws.send(JSON.stringify({ id: seq, method, params }))
  })
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  let ready = false
  for (let i = 0; i < 100; i++) {
    if (await evaluate('typeof window.settle === "function"')) { ready = true; break }
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  assert(ready, 'station fixture initialized before measurement')
  await evaluate('settle()')
  const before = await evaluate('({scans:treeScans,offsets:offsets.length})')
  const unrelated = await evaluate(`(async()=>{for(let i=0;i<100;i++){chat.append(document.createElement('p'));await Promise.resolve()}await settle();return {scans:treeScans,offsets:offsets.length}})()`)
  assert.equal(unrelated.scans, before.scans, 'streaming chat must not rescan sidebar stations')
  const selected = await evaluate(`(async()=>{a.setAttribute('aria-selected','false');b.setAttribute('aria-selected','true');await settle();return {scans:treeScans,offsets:offsets.length}})()`)
  assert.equal(selected.scans, before.scans + 1, 'selection mutations coalesce into one station scan')
  assert.equal(selected.offsets, before.offsets + 1, 'attribute-only selection updates the station')
  const rename = await evaluate(`(async()=>{b.previousElementSibling.firstElementChild.firstChild.data='renamed';await settle();return treeScans})()`)
  assert.equal(rename, selected.scans + 1, 'in-place workspace text changes are observed')
  const disposed = await evaluate(`(async()=>{a.setAttribute('aria-selected','true');stopDial();await settle();return {scans:treeScans,tuners:document.querySelectorAll('[data-dsh-station-tuner]').length}})()`)
  assert.equal(disposed.scans, rename, 'dispose cancels pending scans')
  assert.equal(disposed.tuners, 0, 'dispose removes the tuner')
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ baseline, before, unrelated, selected, rename, disposed }, null, 2))
  console.log('Station observer passed: chat churn ignored; selection, rename and teardown preserved')
} finally {
  ws?.close()
  browser.kill()
}
