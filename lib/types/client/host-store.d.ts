/**
 * Host store adapter. Mineradio 2.3.1 talks to `@deepseek-ai/dsh-client-store`;
 * 2.3.2+ talks to `@deepseek-ai/dsh-client-runtime/client`. A static require of
 * the missing package throws `missed the module table` and the whole client
 * graph fails to load. Probe both packages at factory time and keep the first
 * one the host actually registered.
 */
import type { defineStore as hostDefineStore } from '@deepseek-ai/dsh-client-store';
export type { EngineStoreHandle } from '@deepseek-ai/dsh-client-store';
type DefineStoreFn = typeof hostDefineStore;
/**
 * Resolve `defineStore` from whichever host engine is actually on the module
 * table. Tries runtime first (newer DSH), then store (0.1.2-alpha.1 desktop).
 * @param requireFn - the factory `require` closed over by the client bundle.
 */
export declare function loadHostDefineStore(requireFn: (id: string) => unknown): DefineStoreFn;
/**
 * Default `defineStore` bound at factory evaluation.
 *
 * Do not write a static `require('@deepseek-ai/...')` here: ModuleLoader
 * throws `missed the module table` for the engine the host does not ship,
 * and that aborts the whole plugin graph. The factory `require` is passed
 * through `globalThis.__dshRequire` by the client-bundle wrapper.
 */
export declare const defineStore: DefineStoreFn;
