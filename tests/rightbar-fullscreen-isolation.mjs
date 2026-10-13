#!/usr/bin/env node
// Real host CSS + shipped client CSS; geometry comes from the Desktop DOM capture.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const theme = process.env.MINERADIO_THEME_ROOT ?? path.resolve(here, '..')
const host = path.join(theme, 'tests/fixtures/host')
const out = path.join(theme, 'outputs/fullscreen-isolation')
fs.mkdirSync(out, { recursive: true })
const bundle = fs.readFileSync(path.join(theme, 'lib/client.js'), 'utf8')
let css = [...bundle.matchAll(/\.textContent\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g)]
  .map(m => { assert(!m[1].includes('${'), 'CSS must be a static string'); return vm.runInNewContext(m[1]) }).filter(s => s.includes('{')).join('\n')
assert(css.includes("[data-dsh-aqua] [class*="), 'shipped CSS must be loaded, not source-only CSS')
if (process.argv.includes('--without-isolation')) {
  css = css.replace(/[^{}]+\{[^{}]*\}/g, rule =>
    rule.includes('data-rightbar-fullscreen') && rule.includes('centerCol') ? '' : rule)
}
function hostCss(file, prefix) {
  return fs.readFileSync(path.join(host, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/:global\(([^()]*)\)/g, '$1')
    .replace(/\.([a-zA-Z_][\w-]*)/g, (_, cls) => `.${prefix}${cls}`)
}
const html = `<!doctype html><html data-windows-titlebar data-dsh-aqua data-dsh-float data-platform="win32"><head><meta charset="utf-8"><style>
${hostCss('ui-layout/src/client/AppFrame.module.css', 'live_')}
${hostCss('ui-sidebar-right/src/client/shell/SidebarRight.module.css', 'right_')}
${hostCss('ui-dockkit/src/components/dockkit.module.css', 'kit_')}
${css}
html,body{margin:0;height:100%;--dsh-windows-titlebar-height:40px;--dsh-windows-sidebar-width:200px;--dsh-sidebar-width:400px;--dsw-alias-bg-base:#151517;background:#24504b}
header{height:70px}.live_frame{grid-template-columns:200px minmax(0,1fr) 300px}
.kit_tabHost{height:100%;display:flex;flex-direction:column}.kit_paneBody{flex:1}
#panel{width:300px}#frame[data-rightbar-fullscreen] #panel{width:calc(100vw - 200px)}
#floating{position:fixed;right:15px;bottom:15px;width:80px;height:60px;z-index:60;pointer-events:auto}
</style></head><body><div class="live_frame" id="frame" data-dsh-frame>
<div class="live_sidebarCol" id="sidebar">sidebar</div>
<div class="live_centerCol" id="center"><header id="header">conversation header</header><main id="chat">conversation text that must not bleed through</main><div data-composer-card id="composer"><textarea id="draft">unsent draft</textarea></div><span id="forced" style="visibility:visible">explicit visibility descendant</span></div>
<div class="live_rightbarCol" data-rightbar-col><div class="right_session" id="session"><div class="right_panel" id="panel" data-sidebar-right-panel="push">
<div class="kit_tabCell" data-dockkit-host="dock" data-dockkit-column="0"><div class="kit_tabHost" data-dockkit-pane><div class="kit_tabHostHeader"><button id="fullscreen">fullscreen</button></div><div class="kit_paneBody" id="file">file contents</div></div></div><div id="floating" data-dockkit-host="float">floating</div>
</div></div></div></div><script>
window.measure = () => {
 const center = document.getElementById('center'), panel = document.getElementById('panel');
 const rect = e => ({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height});
 return { center:rect(center),panel:rect(panel),visibility:getComputedStyle(center).visibility,opacity:getComputedStyle(center).opacity,
 visible:['header','chat','composer','forced'].map(id=>document.getElementById(id).checkVisibility({checkVisibilityCSS:true,checkOpacity:true})),
 fileVisible:document.getElementById('file').checkVisibility({checkVisibilityCSS:true,checkOpacity:true}),
 sidebarVisible:document.getElementById('sidebar').checkVisibility({checkVisibilityCSS:true,checkOpacity:true}),
 floatingVisible:document.getElementById('floating').checkVisibility({checkVisibilityCSS:true,checkOpacity:true}),
 hitCenter:document.elementsFromPoint(center.getBoundingClientRect().x+30,150).some(e=>center.contains(e)),draft:document.getElementById('draft').value,
 panelFilter:getComputedStyle(panel).backdropFilter,panelTransform:getComputedStyle(panel).transform }
};
window.present = (mode, open) => { const f=document.getElementById('frame'),p=document.getElementById('panel');f.toggleAttribute('data-rightbar-fullscreen',mode==='fullscreen');p.setAttribute('data-sidebar-right-panel',mode);p.toggleAttribute('data-sidebar-right-open',open); };
</script></body></html>`
const pagePath = path.join(out, 'fixture.html')
fs.writeFileSync(pagePath, html)
const profile = fs.mkdtempSync(path.join(out, 'chrome-'))
const chrome = spawn(process.env.CHROME_BIN ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
 '--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-gpu',pathToFileURL(pagePath).href,
], { stdio:'ignore', windowsHide:true })
let ws
try {
 let port
 for(let i=0;i<100;i++) {try{port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];break}catch{} await new Promise(r=>setTimeout(r,100))}
 assert(port,'Chrome started with a CDP port')
 const pages=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
 ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl)
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject})
 let id=0;const pending=new Map()
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);m.error?reject(new Error(JSON.stringify(m.error))):resolve(m.result)}}
 const send=(method,params={})=>new Promise((resolve,reject)=>{const i=++id;pending.set(i,{resolve,reject});ws.send(JSON.stringify({id:i,method,params}))})
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value}
 await send('Runtime.enable')
 const records=[]
 async function check(label,hidden){
  const m=await evaluate('window.measure()');records.push({label,...m});
  assert.equal(m.draft,'unsent draft',`${label}: draft preserved`)
  assert.equal(m.visibility,hidden?'hidden':'visible',`${label}: center visibility`)
  assert(m.visible.every(v=>v===!hidden),`${label}: header/chat/composer/explicit child visibility`)
  assert(m.sidebarVisible,`${label}: sidebar remains visible`)
  assert(m.floatingVisible,`${label}: independently floating pane remains visible`)
  assert.equal(m.panelFilter,'none',`${label}: no full-panel containing block from blur`)
  assert.equal(m.panelTransform,'none',`${label}: floating geometry preserved`)
  if(hidden){assert(m.fileVisible,`${label}: dock body visible`);assert(!m.hitCenter,`${label}: conversation cannot receive clicks`)}
  return m
 }
 for(const [width,height] of [[1280,800],[960,700],[640,500]]) {
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
  for(const mode of ['float','compat']) for(const scheme of ['dark','light']) {
   await evaluate(`document.documentElement.toggleAttribute('data-dsh-float',${mode==='float'});document.documentElement.toggleAttribute('data-dsh-compat',${mode==='compat'});document.body.toggleAttribute('data-ds-dark-theme',${scheme==='dark'});present('push',true)`)
   const label=`${width} ${mode} ${scheme}`
   const before=await check(label+' push',false)
   await evaluate("present('fullscreen',true)")
   const full=await check(label+' fullscreen',true)
   assert.deepEqual(full.center,before.center,label+': grid track retained')
   assert(full.panel.x<=full.center.x && full.panel.width>full.center.width,label+': actual overlap geometry reproduced')
   await evaluate("present('fullscreen',false)");await check(label+' collapse',false)
   await evaluate("present('fullscreen',true)");await check(label+' reopen',true)
   await evaluate("present('push',true)");await check(label+' exit',false)
   await evaluate("present('fullscreen',true);document.documentElement.removeAttribute('data-dsh-aqua')");await check(label+' theme off',false)
   await evaluate("document.documentElement.setAttribute('data-dsh-aqua','')");await check(label+' theme on',true)
   await evaluate("present('push',true);document.getElementById('frame').setAttribute('data-rightbar-fullscreen','true');var stale=document.getElementById('session').cloneNode(true);stale.hidden=true;stale.removeAttribute('id');stale.querySelector('[data-sidebar-right-panel]').setAttribute('data-sidebar-right-panel','fullscreen');document.querySelector('[data-rightbar-col]').append(stale)")
   await check(label+' stale hidden session',false)
   await evaluate("document.querySelector('[data-rightbar-col] > [hidden]').remove()")
  }
 }
 fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(records,null,2))
 console.log(`Rightbar isolation passed: ${records.length} state/viewport/scheme checks against shipped CSS`)
} finally { ws?.close();chrome.kill() }
