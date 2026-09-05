/**
 * Host store adapter. Mineradio 2.3.1 talks to `@deepseek-ai/dsh-client-store`;
 * 2.3.2+ talks to `@deepseek-ai/dsh-client-runtime/client`. A static require of
 * the missing package throws `missed the module table` and the whole client
 * graph fails to load. Probe both packages at factory time and keep the first
 * one the host actually registered.
 */
export interface EngineStoreHandle<State, Actions> {
  spec: unknown
  create: (scopeKey?: string) => {
    actions: Actions
    getSnapshot: () => State
    subscribe: (fn: () => void) => () => void
    store: unknown
    clearPersisted: () => void
  }
}

interface DefineStoreDecl<State, Actions extends Record<string, (...args: never[]) => unknown>> {
  init: () => State
  persist?: string
  actions: {
    [K in keyof Actions]: (draft: State, ...args: Parameters<Actions[K]>) => void
  }
}

type DefineStoreFn = <State, Actions extends Record<string, (...args: never[]) => unknown>>(
  decl: DefineStoreDecl<State, Actions>,
) => EngineStoreHandle<State, Actions>

const STORE_CANDIDATES = [
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-client-store',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readDefineStore(mod: unknown): DefineStoreFn | undefined {
  if (!isRecord(mod)) return undefined
  const direct = mod.defineStore
  if (typeof direct === 'function') return direct as DefineStoreFn
  const nested = mod.default
  if (isRecord(nested) && typeof nested.defineStore === 'function') {
    return nested.defineStore as DefineStoreFn
  }
  return undefined
}

/**
 * Resolve `defineStore` from whichever host engine is actually on the module
 * table. Tries runtime first (newer DSH), then store (0.1.2-alpha.1 desktop).
 * @param requireFn - the factory `require` closed over by the client bundle.
 */
export function loadHostDefineStore(requireFn: (id: string) => unknown): DefineStoreFn {
  const errors: string[] = []
  for (const id of STORE_CANDIDATES) {
    try {
      const defineStore = readDefineStore(requireFn(id))
      if (defineStore !== undefined) return defineStore
      errors.push(`${id}: loaded but has no defineStore export`)
    } catch (error) {
      errors.push(`${id}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  throw new Error(
    `dsh-theme-mineradio: no host store engine. Need @deepseek-ai/dsh-client-store (DSH 0.1.2-alpha.1) or @deepseek-ai/dsh-client-runtime (0.1.1-rc.2+). Tried:\n${errors.join('\n')}`,
  )
}

/**
 * Default `defineStore` bound at factory evaluation.
 *
 * Do not write a static `require('@deepseek-ai/...')` here: ModuleLoader
 * throws `missed the module table` for the engine the host does not ship,
 * and that aborts the whole plugin graph. The factory `require` is passed
 * through `globalThis.__dshRequire` by the client-bundle wrapper.
 */
export const defineStore: DefineStoreFn = loadHostDefineStore((id) => {
  const hostRequire = (globalThis as { __dshRequire?: (spec: string) => unknown }).__dshRequire
  if (typeof hostRequire !== 'function') {
    throw new Error('dsh-theme-mineradio: host require is not bound')
  }
  return hostRequire(id)
})
