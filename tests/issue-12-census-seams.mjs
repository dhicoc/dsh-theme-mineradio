#!/usr/bin/env node
// Runs the two owned TypeScript modules directly; never builds or touches lib/.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const baseline = process.argv.includes('--baseline')
const baselineCommit = '13f1b892e4e557bb1459d8afbfd0ba67e76ec221'
const output = path.join(root, 'outputs/issue-12-census-seams')
fs.mkdirSync(output, { recursive: true })
const temp = fs.mkdtempSync(path.join(output, 'run-'))
const modules = ['role-census', 'seam-stamper'].map(name => {
  const file = `src/client/${name}.ts`
  const original = baseline || process.argv.includes(`--original-${name}`)
  const source = original
    ? execFileSync('git', ['show', `${baselineCommit}:${file}`], { cwd: root, encoding: 'utf8' })
    : fs.readFileSync(path.join(root, file), 'utf8')
  return ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
    .replace(/^export /gm, '')
})
const html = `<!doctype html><html data-dsh-aqua><head><meta charset="utf-8"><style>
html,body {margin:0} #root {display:flex;flex-direction:column;width:1200px}
.face {width:320px;height:200px;background:#222} .small {width:120px;height:60px;background:#222}
[data-md-role] {background:rgba(0,0,0,.2);box-shadow:inset 0 0 0 1px white;backdrop-filter:blur(12px)}
[data-md-role=ground],[data-md-role=structure] {background:transparent;box-shadow:none;backdrop-filter:none}
.hidden-parent .face {display:none} .unpainted .face {background:transparent}
#rightbar .face {width:1100px;height:700px} [data-sidebar-right-panel] {position:absolute}
#veil {position:fixed;width:320px;height:200px;background:transparent} #veil::before {content:'';position:absolute;inset:0;background:#222}
[data-question-key] section {box-shadow:inset 0 0 0 1px white;background:rgba(25,25,25,.2);backdrop-filter:blur(12px)}
</style></head><body><div id="root"><div id="frame"><aside class="live_sidebarCol"><div class="live_root"><button class="live_brand">brand</button><button class="live_newSession">new</button></div></aside><header>header</header><main id="center"><div id="parent"><div id="target" class="face"></div><div id="sibling" class="face"></div></div><div id="rightbar" data-rightbar-col><div id="panel" data-sidebar-right-panel="push" data-sidebar-right-open><div id="rightface" class="face"></div></div></div><div data-question-key="q"><section id="question"><header>Question</header><button>Answer</button></section></div><div id="composer"><div data-composer-card><button class="live_add">+</button></div><div data-slot="conversation.composer.dock"><div class="live_root">stats</div></div></div><div id="veil"></div><pre id="code" class="face">sharp code</pre><div class="terminal"><div id="terminalInk" class="face">sharp terminal</div></div><div id="own" class="face" data-dsh-aqua-glow></div><div id="ignored" class="face" data-md-ignore></div><div id="stream"></div><div id="noise"></div></main></div></div><script>
${modules.join('\n')}
window.events=[];window.counts={rootScans:0,globalQueries:0,rects:0};let tick=0;
(function next(){tick++;requestAnimationFrame(next)})();
const eq=Element.prototype.querySelectorAll,dq=Document.prototype.querySelectorAll,d1=Document.prototype.querySelector;
Element.prototype.querySelectorAll=function(s){if(this.id==='root'&&s==='*')counts.rootScans++;return eq.call(this,s)};
Document.prototype.querySelectorAll=function(s){counts.globalQueries++;return dq.call(this,s)};
Document.prototype.querySelector=function(s){counts.globalQueries++;return d1.call(this,s)};
const rect=Element.prototype.getBoundingClientRect;Element.prototype.getBoundingClientRect=function(){counts.rects++;events.push({kind:'read',id:this.id,tick});return rect.call(this)};
for(const method of ['setAttribute','removeAttribute']){const orig=Element.prototype[method];Element.prototype[method]=function(name,...args){if(name.startsWith('data-md-'))events.push({kind:'write',id:this.id,tick});return orig.call(this,name,...args)}}
const noise=document.getElementById('noise');for(let i=0;i<240;i++){const el=document.createElement('div');el.className='small';noise.append(el)}
window.census=startRoleCensus();window.stopSeams=startSeamStamper();
window.resetMetrics=()=>{events.length=0;counts={rootScans:0,globalQueries:0,rects:0}};
window.settle=async()=>{for(let i=0;i<200;i++){await new Promise(requestAnimationFrame);if(census.stats().pending===0){await new Promise(requestAnimationFrame);if(census.stats().pending===0)return}}throw Error('census did not settle')};
window.role=id=>document.getElementById(id).getAttribute('data-md-role');
</script></body></html>`
const page = path.join(temp, 'fixture.html')
fs.writeFileSync(page, html)
const profile = path.join(temp, 'chrome')
const chrome = spawn(process.env.CHROME_BIN ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', pathToFileURL(page).href,
], { stdio: 'ignore', windowsHide: true })
let ws
try {
  let port
  for (let i=0;i<100;i++) {try {port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];break} catch {} await new Promise(r=>setTimeout(r,100))}
  assert(port, 'Chrome exposes CDP')
  const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl)
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject})
  let id=0;const pending=new Map()
  ws.onmessage=e=>{const m=JSON.parse(e.data);const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}}
  const send=(method,params={})=>new Promise((resolve,reject)=>{const i=++id;pending.set(i,{resolve,reject});ws.send(JSON.stringify({id:i,method,params}))})
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}
  await send('Runtime.enable')
  let ready = false
  for (let i = 0; i < 100; i += 1) {
    if (await evaluate("typeof settle === 'function'")) { ready = true; break }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert(ready, 'fixture initializes settle() before performance assertions')
  await evaluate('settle()')
  const initial = await evaluate(`({roles:['target','sibling','rightface','question'].map(role),reads:counts.rects,events})`)
  const interleaved = events => {
    const frames=new Map();for(const e of events){const list=frames.get(e.tick)??[];list.push(e);frames.set(e.tick,list)}
    return [...frames.values()].filter(list=>{const reads=list.map((e,i)=>e.kind==='read'?i:-1).filter(i=>i>=0);return reads.length>1&&list.slice(reads[0]+1,reads.at(-1)).some(e=>e.kind==='write')}).length
  }
  const initialInterleaved=interleaved(initial.events)
  await evaluate(`resetMetrics();document.getElementById('target').setAttribute('data-state','active');settle()`)
  await evaluate('new Promise(r=>setTimeout(r,380))')
  const attribute=await evaluate('({...counts,stats:census.stats()})')
  await evaluate(`resetMetrics();for(let i=0;i<12;i++){document.getElementById('stream').append(document.createTextNode('token'))};new Promise(requestAnimationFrame)`)
  const stream=await evaluate('({...counts})')
  console.log(JSON.stringify({mode:baseline?'baseline':'fixed',initialRoles:initial.roles,initialInterleaved,attribute,stream},null,2))
  if (baseline) {
    assert(attribute.rootScans>0, 'baseline reproduces delayed root enumeration')
    assert(initialInterleaved>0, 'baseline reproduces read/write layout interleaving')
    assert(stream.globalQueries>=16, 'baseline reproduces global seams for text streaming')
    console.log('Baseline root causes reproduced (negative control).')
  } else {
    assert.deepEqual(initial.roles,['pane','pane','pane',null], 'glass faces, rightbar exception and hand-dressed question survive')
    assert.equal(initialInterleaved,0,'census batches geometry reads before stamp commits')
    assert.equal(attribute.rootScans,0,'local attributes never enumerate the root')
    assert.equal(stream.globalQueries,0,'text streaming never runs global seam selectors')
    assert.deepEqual(await evaluate(`['code','terminalInk','own','ignored','panel'].map(role)`),[null,null,null,null,null],'readability, own layers, opt-out and fixed panel anchors stay untouched')
    assert.deepEqual(await evaluate(`({role:role('veil'),veil:document.getElementById('veil').getAttribute('data-md-veil'),spot:document.getElementById('veil').hasAttribute('data-md-spot')})`),{role:'overlay',veil:'before',spot:false},'pseudo-element glass keeps one carrier without tilt')
    await evaluate(`resetMetrics();for(let i=0;i<100;i++)document.getElementById('target').setAttribute('data-state',String(i));settle()`)
    assert.equal(await evaluate('counts.rects'),1,'one frame coalesces 100 changes to one face measurement')
    await evaluate(`resetMetrics();document.getElementById('target').style.setProperty('--spot-x','20px');settle()`)
    assert.equal(await evaluate('counts.rects'),0,'spot inline output stays outside census inputs')
    const countBeforeRemove=await evaluate('census.stats().stamped')
    await evaluate(`window.detached=document.getElementById('sibling');detached.remove();settle()`)
    assert.equal(await evaluate('census.stats().stamped'),countBeforeRemove-1,'detached faces release census ownership and counters')
    await evaluate(`document.getElementById('parent').append(detached);settle()`)
    assert.equal(await evaluate(`role('sibling')`),'pane','reinsertion reclassifies previously decided elements')
    await evaluate(`document.getElementById('parent').classList.add('hidden-parent');settle()`)
    assert.equal(await evaluate(`role('target')`),null,'ancestor visibility clears descendant roles')
    await evaluate(`document.getElementById('parent').classList.remove('hidden-parent');settle()`)
    assert.equal(await evaluate(`role('target')`),'pane','ancestor visibility restoration reclassifies descendants')
    await evaluate(`document.getElementById('parent').classList.add('unpainted');settle()`)
    assert.equal(await evaluate(`role('target')`),null,'host paint change is measured without census glass masking it')
    await evaluate(`document.getElementById('parent').classList.remove('unpainted');settle()`)
    assert.equal(await evaluate(`role('target')`),'pane')
    await evaluate(`document.getElementById('panel').setAttribute('data-sidebar-right-panel','fullscreen');settle()`)
    assert.equal(await evaluate(`role('rightface')`),'pane','fullscreen rightbar stays glass')
    await evaluate(`resetMetrics();var live=document.createElement('button');live.setAttribute('aria-label','Stop generating');document.querySelector('[data-composer-card]').append(live);settle()`)
    assert(await evaluate(`document.getElementById('composer').hasAttribute('data-dsh-on-air')`),'composer live lamp turns on')
    await evaluate(`live.remove();settle()`)
    assert.equal(await evaluate(`document.getElementById('composer').hasAttribute('data-dsh-on-air')`),false,'composer live lamp turns off')
    await evaluate(`var mount=document.createElement('div');mount.innerHTML='<div id="newbar"><div data-composer-card><button class="live_add">+</button></div></div><div id="newOverlay" data-conversation-composer-overlay></div>';document.getElementById('center').append(mount);settle()`)
    assert(await evaluate(`document.getElementById('newbar').hasAttribute('data-dsh-inputbar')&&document.getElementById('newbar').hasAttribute('data-dsh-aqua-spot')`),'new composer parent and dependent spotlight seams stamp together')
    assert(await evaluate(`document.getElementById('newOverlay').hasAttribute('data-dsh-trajectory')&&document.getElementById('newOverlay').hasAttribute('data-dsh-aqua-spot')`),'new trajectory gains both dependent seams')
    await evaluate(`var late=document.createElement('header');late.id='lateHeader';document.getElementById('center').append(late);settle()`)
    assert.equal(await evaluate(`document.getElementById('lateHeader').hasAttribute('data-dsh-aqua-spot')`),false,'first seam retains document-wide first-match behavior')
    await evaluate(`document.querySelector('#frame > header').remove();settle()`)
    assert(await evaluate(`document.querySelector('header').hasAttribute('data-dsh-aqua-spot')`),'removing first header promotes its successor')
    await evaluate(`census.rescan();settle()`)
    const stats=await evaluate(`({stats:census.stats(),actual:document.querySelectorAll('[data-md-role]').length})`)
    assert.equal(stats.stats.stamped,stats.actual,'rescan counters agree with stamped DOM')
    await evaluate(`census.dispose();stopSeams()`)
    assert.equal(await evaluate(`document.querySelectorAll('[data-md-role],[data-md-spot],[data-md-veil]').length`),0,'dispose removes census-owned effects')
    console.log('Issue #12 census/seam behavior and performance checks passed.')
  }
} finally {
  ws?.close();chrome.kill()
  // Keep this run's workspace fixture/profile for postmortem evidence.
}
