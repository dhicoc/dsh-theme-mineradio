#!/usr/bin/env node
// Chromium/CDP regression: source-only bundle, no production build or lib writes.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(root, 'package.json'))
const legacy = process.argv.includes('--baseline')
const reportOnly = process.argv.includes('--report-only')
const outputRoot = path.join(root, 'outputs', 'issue-11-composer-glow')
fs.mkdirSync(outputRoot, { recursive: true })
const out = fs.mkdtempSync(path.join(outputRoot, legacy ? 'baseline-' : 'current-'))
const baselineRef = process.env.ISSUE_11_BASELINE_REF ?? '13f1b892e4e557bb1459d8afbfd0ba67e76ec221'
const original = file => execFileSync('git', ['show', `${baselineRef}:src/client/${file}`], { cwd: root, encoding: 'utf8' })
const options = { absWorkingDir: root, bundle: true, format: 'iife', globalName: 'Spot', platform: 'browser', write: false }
if (legacy) options.plugins = [{ name: 'baseline', setup(build) { build.onLoad({ filter: /(?:spotlight|spot-core)\.ts$/ }, args => ({ contents: original(path.basename(args.path)), loader: 'ts', resolveDir: path.dirname(args.path) })) } }]
// esbuild's child binary cannot enumerate src/client or resolve relative
// imports in this environment, so a plugin supplies every relative import
// through Node fs (same workaround as build-tools/build-stdin.mjs).
const feedPlugin = { name: 'feed-relative', setup(build) { build.onResolve({ filter: /^\.\.?\// }, args => ({ path: path.join(root, 'src/client', args.path), namespace: 'feed' })); build.onLoad({ filter: /.*/, namespace: 'feed' }, args => ({ contents: fs.readFileSync(args.path, 'utf8'), loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts', resolveDir: root })) } }
const code = (await require('esbuild').build({ ...options, plugins: [...(options.plugins ?? []), feedPlugin], stdin: { contents: fs.readFileSync(path.join(root, 'src/client/spotlight.ts'), 'utf8'), loader: 'ts', resolveDir: path.join(root, 'src/client') } })).outputFiles[0].text
const core = (await require('esbuild').build({ ...options, plugins: [...(options.plugins ?? []), feedPlugin], globalName: 'Core', stdin: { contents: fs.readFileSync(path.join(root, 'src/client/spot-core.ts'), 'utf8'), loader: 'ts', resolveDir: path.join(root, 'src/client') } })).outputFiles[0].text
const html = `<!doctype html><html data-dsh-aqua-spotlight><style>
html,body{margin:0}body{padding:37px}#frame{position:relative;width:760px;height:510px;border:7px solid #678;overflow:auto;transform-origin:0 0}#content{padding:17px}#messages{height:2600px;background:linear-gradient(#eee,#abc)}#seat{position:relative;padding:19px 23px;border:4px solid #789}#bar{display:contents;position:relative}[data-composer-card]{height:98px;border:3px solid #568;box-sizing:border-box;background:#cdf}[data-dsh-stats]{height:28px;border:2px solid #568;box-sizing:border-box;background:#ace}[data-dsh-aqua-spot]{position:relative}[data-dsh-aqua-glow]{position:absolute;inset:0;pointer-events:none;opacity:.25;background:#ff0;z-index:2}#boxed{margin-top:12px;height:110px;border:5px solid #349;overflow:auto}#inner{height:500px;padding-top:25px}#boxed [data-composer-card]{height:60px;width:80%;margin-left:13px}
</style><div id="frame"><div id="content"><div id="messages"></div><div id="seat"><div id="bar" data-dsh-inputbar data-dsh-aqua-spot><div data-composer-card id="card">Composer</div><div data-dsh-stats id="stats">Stats</div></div></div></div></div><div id="boxed" data-dsh-aqua-spot><div id="inner"><div data-composer-card id="innerCard">Nested border/scroll</div></div></div><script>${code}\n${core}</script><script>
window.frames2=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
window.stop=Spot.startSpotlight();
window.rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
window.measure=(id='bar')=>{const s=document.getElementById(id),c=s.querySelector('[data-composer-card]'),t=s.querySelector('[data-dsh-stats]'),g=s.querySelector(':scope > [data-dsh-aqua-glow]'),a=rect(c),b=t?rect(t):a;return {height:frame.scrollHeight,top:frame.scrollTop,client:frame.clientHeight,glass:{left:Math.min(a.left,b.left),top:Math.min(a.top,b.top),right:Math.max(a.right,b.right),bottom:Math.max(a.bottom,b.bottom)},glow:rect(g),local:{left:g.style.left,top:g.style.top,width:g.style.width,height:g.style.height},offsetParent:g.offsetParent?.id,boxedTop:boxed.scrollTop}};
window.hover=async(id='bar')=>{const c=document.getElementById(id).querySelector('[data-composer-card]'),r=c.getBoundingClientRect();c.dispatchEvent(new PointerEvent('pointerover',{bubbles:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));await frames2();return measure(id)};
window.__issue11Ready = true;
</script>`
const page = path.join(out, 'fixture.html'); fs.writeFileSync(page, html)
const profile = fs.mkdtempSync(path.join(out, 'chrome-'))
const chrome = spawn(process.env.CHROME_BIN ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', pathToFileURL(page).href], { stdio: 'ignore', windowsHide: true })
let ws
try {
 let port
 for (let i = 0; i < 100; i++) { try { port = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; break } catch {} await new Promise(r => setTimeout(r, 100)) }
 assert(port, 'Chrome started')
 const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
 ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl)
 await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
 let id = 0; const pending = new Map()
 ws.onmessage = e => { const m = JSON.parse(e.data); if (pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result) } }
 const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })) })
 const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value }
 await send('Runtime.enable')
 // CDP may attach before the file page has parsed its inline bundles.
 const ready = await evaluate(`new Promise((resolve,reject)=>{
  const deadline=Date.now()+10000;
  const check=()=>{
   if(document.readyState==='complete' && window.__issue11Ready===true
    && typeof window.Spot?.startSpotlight==='function'
    && typeof window.Core?.startOverlayKeeper==='function'
    && typeof window.hover==='function' && typeof window.measure==='function') resolve(true);
   else if(Date.now()>=deadline) reject(new Error('Issue #11 fixture/module readiness timed out'));
   else setTimeout(check,20);
  };check();
 })`)
 assert.equal(ready,true,'fixture and both source modules initialized')
 await evaluate('frames2()')
 const results = []
 function check(label, before, after) {
  results.push({label,before,after})
  fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(results,null,2))
  if (reportOnly) return
  assert.equal(after.height,before.height,`${label}: glow preserves scrollHeight`)
  assert.equal(after.top,before.top,`${label}: glow preserves scrollTop`)
  for(const edge of ['left','top','right','bottom']) assert(Math.abs(after.glass[edge]-after.glow[edge])<1.1,`${label}: ${edge} aligned (${after.glass[edge]} vs ${after.glow[edge]})`)
 }
 if (!process.argv.includes('--keeper-only')) {
 for (const stats of [true,false]) for (const scale of [1,.8,1.15]) {
  await evaluate(`(async()=>{stop();const band=document.getElementById('stats');if(band) band.remove();${stats?"bar.insertAdjacentHTML('beforeend','<div data-dsh-stats id=\"stats\">Stats</div>');":''}frame.style.transform='translate(13px, 11px) scale(${scale})';window.stop=Spot.startSpotlight();frame.scrollTop=frame.scrollHeight;await frames2()})()`)
  const before=await evaluate('measure()'),after=await evaluate('hover()');check(`contents stats=${stats} scale=${scale}`,before,after)
 }
 await evaluate("(async()=>{frame.style.transform='none';frame.scrollTop-=60;await frames2();await frames2()})()")
 const scrolled=await evaluate('measure()');check('scroll during hover',scrolled,scrolled)
 const beforeResize=await evaluate('measure()')
 await evaluate("(async()=>{frame.style.width='650px';window.dispatchEvent(new Event('resize'));await frames2();await frames2()})()")
 check('resize during hover',beforeResize,await evaluate('measure()'))
 const beforeRebuild=await evaluate('measure()')
 await evaluate("(async()=>{card.replaceWith(card.cloneNode(true));bar.querySelector(':scope > [data-dsh-aqua-glow]').remove();await frames2();await frames2()})()")
 check('React replacement and overlay repair',beforeRebuild,await evaluate('measure()'))
 await evaluate("(async()=>{stop();window.stop=Spot.startSpotlight();boxed.scrollTop=18;await frames2()})()")
 check('bordered owner with own scroll',await evaluate("measure('boxed')"),await evaluate("hover('boxed')"))
 await evaluate("(async()=>{boxed.scrollTop=29;await frames2();await frames2()})()")
 const ownScroll=await evaluate("measure('boxed')");check('own scroll during hover',ownScroll,ownScroll)
 // A static scrolling wrapper sits between the card and its offset parent.
 await evaluate("(async()=>{stop();inner.style.cssText='height:90px;overflow:auto;padding-top:25px';innerCard.style.marginTop='20px';innerCard.insertAdjacentHTML('afterend','<div style=\"height:300px\"></div>');window.stop=Spot.startSpotlight();inner.scrollTop=16;await frames2()})()")
 check('non-offset-parent scroll',await evaluate("measure('boxed')"),await evaluate("hover('boxed')"))
 await evaluate("(async()=>{stop();inner.style.cssText='';boxed.style.cssText='transform:perspective(800px) rotateX(.01rad) rotateY(-.012rad) scale(1.01)';window.stop=Spot.startSpotlight();await frames2()})()")
 check('own 3D transform',await evaluate("measure('boxed')"),await evaluate("hover('boxed')"))
 // The zero-box owner may also use the initial containing block.
 await evaluate("(async()=>{stop();frame.style.position='static';frame.style.transform='none';seat.style.position='static';window.stop=Spot.startSpotlight();await frames2()})()")
 check('initial containing block',await evaluate('measure()'),await evaluate('hover()'))
 }
 const keeper=await evaluate(`(async()=>{
  stop();window.queries={global:0,subtree:0};window.calls=0;
  const dq=Document.prototype.querySelectorAll,eq=Element.prototype.querySelectorAll;
  const spotSelector=Core.SPOT_SELECTOR;
  Document.prototype.querySelectorAll=function(s){if(s===spotSelector)queries.global++;return dq.call(this,s)};
  Element.prototype.querySelectorAll=function(s){if(s===spotSelector){if(this===document.documentElement)queries.global++;else queries.subtree++}return eq.call(this,s)};
  const done=Core.startOverlayKeeper(()=>calls++);await frames2();const initial={...queries,calls};queries.global=queries.subtree=calls=0;
  const stream=document.createElement('div');stream.id='stream';messages.append(stream);await frames2();queries.global=queries.subtree=calls=0;
  for(let i=0;i<200;i++){stream.textContent='token '+i;await Promise.resolve()}
  await frames2();await frames2();const tokens={...queries,calls};queries.global=queries.subtree=calls=0;
  const batch=document.createElement('section');for(let i=0;i<80;i++){const el=document.createElement('article');el.setAttribute(Core.SPOT_ATTR,'');batch.append(el)}
  messages.append(batch);await frames2();await frames2();const added={...queries,calls,glows:batch.querySelectorAll('[data-dsh-aqua-glow]').length};queries.global=queries.subtree=calls=0;
  const owner=batch.firstElementChild;owner.querySelector('[data-dsh-aqua-glow]').remove();await frames2();await frames2();const repaired={...queries,calls,glows:owner.querySelectorAll('[data-dsh-aqua-glow]').length};queries.global=queries.subtree=calls=0;
  owner.removeAttribute(Core.SPOT_ATTR);await frames2();await frames2();const unmarked={...queries,calls,glows:owner.querySelectorAll('[data-dsh-aqua-glow]').length};queries.global=queries.subtree=calls=0;
  owner.setAttribute(Core.ROLE_SPOT_ATTR,'');await frames2();await frames2();const marked={...queries,calls,glows:owner.querySelectorAll('[data-dsh-aqua-glow]').length};
  done();const disposed=document.querySelectorAll('[data-dsh-aqua-glow]').length;
  Document.prototype.querySelectorAll=dq;Element.prototype.querySelectorAll=eq;
  return {initial,tokens,added,repaired,unmarked,marked,disposed}
 })()`)
 fs.writeFileSync(path.join(out,'keeper.json'),JSON.stringify(keeper,null,2))
 if(!reportOnly){
  assert.equal(keeper.initial.global,1,'one bootstrap global discovery')
  assert.equal(keeper.tokens.global,0,'streaming never scans all spots')
  assert.equal(keeper.tokens.subtree,0,'text-only churn scans no element subtrees')
  assert.equal(keeper.tokens.calls,1,'200 microtask mutations coalesce into one callback')
  assert.equal(keeper.added.global,0,'new panes do not trigger global discovery')
  assert.equal(keeper.added.subtree,1,'scan the batch root once')
  assert.equal(keeper.added.calls,1,'own glow writes do not amplify callbacks')
  assert.equal(keeper.added.glows,80)
  assert.equal(keeper.repaired.calls,1);assert.equal(keeper.repaired.glows,1)
  assert.equal(keeper.unmarked.calls,1);assert.equal(keeper.unmarked.glows,0)
  assert.equal(keeper.marked.calls,1);assert.equal(keeper.marked.glows,1)
  assert.equal(keeper.disposed,0)
 }
 console.log(JSON.stringify({legacy,reportOnly,out,geometryChecks:results.length,keeper,first:results[0]},null,2))
} finally { ws?.close(); chrome.kill() }
