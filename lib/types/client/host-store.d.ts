/**
 * Host store adapter. Mineradio 2.3.1 talks to `@deepseek-ai/dsh-client-store`;
 * 2.3.2+ talks to `@deepseek-ai/dsh-client-runtime/client`.
 */
export interface EngineStoreHandle<State, Actions> {
    spec: unknown;
    create: (scopeKey?: string) => {
        actions: Actions;
        getSnapshot: () => State;
        subscribe: (fn: () => void) => () => void;
        store: unknown;
        clearPersisted: () => void;
    };
}
type DefineStoreFn = <State, Actions extends Record<string, (...args: never[]) => unknown>>(decl: {
    init: () => State;
    persist?: string;
    actions: {
        [K in keyof Actions]: (draft: State, ...args: Parameters<Actions[K]>) => void;
    };
}) => EngineStoreHandle<State, Actions>;
export declare function loadHostDefineStore(requireFn: (id: string) => unknown): DefineStoreFn;
export declare const defineStore: DefineStoreFn;
export {};
