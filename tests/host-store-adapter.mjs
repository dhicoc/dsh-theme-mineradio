import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const candidates = ['@deepseek-ai/dsh-client-runtime/client', '@deepseek-ai/dsh-client-runtime', '@deepseek-ai/dsh-client-store']
async function compile(entry) {
  const result = await build({ absWorkingDir:root, entryPoints:[entry], bundle:true, platform:'node', format:'cjs', write:false, metafile:true })
  return { code:result.outputFiles[0].text, imports:Object.values(result.metafile.outputs).flatMap(o=>o.imports) }
}
const adapter = await compile('src/client/host-store.ts')
const settings = await compile('src/client/settings-store.ts')
function load(code, requireFn) {
  const module = { exports:{} }
  vm.runInNewContext(code, { module, globalThis:{ __dshRequire:requireFn } }, { timeout:1000 })
  return module.exports
}
function resolver(modules, calls=[]) {
  return id => {
    calls.push(id)
    if (!(id in modules)) throw new Error(`missed the module table: ${id}`)
    return modules[id]
  }
}
// A framework-neutral engine double: the tested adapter only chooses a factory;
// the real mutator body is applied unchanged, with bound actions stripping draft.
function engine(spec) {
  return {
    spec,
    create() {
      let snapshot = structuredClone(spec.init())
      const subscribers = new Set()
      const actions = Object.fromEntries(Object.entries(spec.actions).map(([name, mutator]) => [name, (...params) => {
        const draft = structuredClone(snapshot)
        mutator(draft, ...params)
        if (JSON.stringify(draft) !== JSON.stringify(snapshot)) {
          snapshot = draft
          for (const fn of subscribers) fn()
        }
      }]))
      return { actions, getSnapshot:()=>snapshot, subscribe:fn=>{subscribers.add(fn);return ()=>subscribers.delete(fn)}, clearPersisted(){} }
    },
  }
}
const direct = { defineStore:engine }

test('type-only host imports introduce no static engine dependency', () => {
  assert.deepEqual(adapter.imports, [])
  assert.deepEqual(settings.imports, [])
})
test('runtime/client factory wins without probing unavailable fallbacks', () => {
  const calls=[]
  const result=load(adapter.code,resolver({[candidates[0]]:direct,[candidates[2]]:{defineStore:()=>{throw new Error('legacy engine should not run')}}},calls))
  assert.equal(result.defineStore,engine)
  assert.deepEqual(calls,[candidates[0]])
})
test('runtime root remains a valid fallback', () => {
  const calls=[]
  const result=load(adapter.code,resolver({[candidates[1]]:direct},calls))
  assert.equal(result.defineStore,engine)
  assert.deepEqual(calls,candidates.slice(0,2))
})
test('legacy client-store remains valid when runtime packages are absent', () => {
  const calls=[]
  const result=load(adapter.code,resolver({[candidates[2]]:direct},calls))
  assert.equal(result.defineStore,engine)
  assert.deepEqual(calls,candidates)
})
test('default exports work for runtime and legacy modules', () => {
  for(const id of [candidates[0],candidates[2]]) {
    assert.equal(load(adapter.code,resolver({[id]:{default:direct}})).defineStore,engine)
  }
})
test('malformed exports are skipped rather than selected as engines', () => {
  const result=load(adapter.code,resolver({[candidates[0]]:null,[candidates[1]]:{defineStore:'invalid',default:{defineStore:42}},[candidates[2]]:direct}))
  assert.equal(result.defineStore,engine)
})
test('missing engines report all attempted module identities', () => {
  assert.throws(()=>load(adapter.code,resolver({})),error=>{
    assert.match(error.message,/no host store engine/)
    for(const id of candidates)assert(error.message.includes(id))
    return true
  })
})
test('bound settings sync preserves all fields and rejects stale revisions', () => {
  const {createMineradioRowStore}=load(settings.code,resolver({[candidates[0]]:direct}))
  const handle=createMineradioRowStore(),instance=handle.create()
  const {revision,...initial}=instance.getSnapshot()
  assert.equal(revision,-1)
  const payload={...initial,enabled:false,mode:'compat',blur:16,wallpaper:'idb:retained-wallpaper'}
  let notifications=0;const unsubscribe=instance.subscribe(()=>notifications++)
  instance.actions.sync(payload,0)
  for(const [key,value] of Object.entries(payload))assert.equal(instance.getSnapshot()[key],value,key)
  assert.equal(instance.getSnapshot().revision,0)
  assert.equal(notifications,1)
  const accepted=instance.getSnapshot()
  instance.actions.sync({...payload,enabled:true},0)
  instance.actions.sync({...payload,enabled:true},-1)
  assert.equal(instance.getSnapshot(),accepted)
  assert.equal(notifications,1)
  instance.actions.sync({...payload,enabled:true},2)
  assert.equal(instance.getSnapshot().enabled,true)
  assert.equal(instance.getSnapshot().revision,2)
  assert.equal(accepted.enabled,false)
  assert.equal(notifications,2)
  unsubscribe();instance.actions.sync(payload,3)
  assert.equal(notifications,2)
})
test('plugin and appearance mirror instances remain independent', () => {
  const {createMineradioRowStore}=load(settings.code,resolver({[candidates[2]]:direct}))
  const plugin=createMineradioRowStore().create(),appearance=createMineradioRowStore().create()
  const {revision,...payload}=plugin.getSnapshot()
  assert.equal(revision,-1)
  plugin.actions.sync({...payload,enabled:false},1)
  assert.equal(plugin.getSnapshot().enabled,false)
  assert.equal(appearance.getSnapshot().enabled,true)
  assert.equal(appearance.getSnapshot().revision,-1)
})
fs.mkdirSync(path.join(root,'outputs/typecheck-fix-20261013'),{recursive:true})
fs.writeFileSync(path.join(root,'outputs/typecheck-fix-20261013/adapter-imports.json'),JSON.stringify({adapter:adapter.imports,settings:settings.imports},null,2))
