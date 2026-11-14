// Compile-only assertions: regressions must fail under the normal strict tsc gate.
import type { BoundActions, PropsStore, StoreDecl } from '@deepseek-ai/dsh-client-ui-slots'
import { defineStore } from '../../src/client/host-store.ts'
import { createMineradioRowStore, type MineradioSettingsPayload } from '../../src/client/settings-store.ts'
import type { createMineradioRowStore as PublishedCreateStore } from '../../lib/types/client/settings-store'


type RowHandle = ReturnType<typeof createMineradioRowStore>
declare const handle: RowHandle
declare const actions: BoundActions<RowHandle>
declare const props: PropsStore<RowHandle>
declare const payload: MineradioSettingsPayload

const registrationStore: StoreDecl = handle
const enabled: boolean = props.useStore(s => s.enabled)
const blur: number = props.useStore(s => s.blur)
const customTextColor: string = props.useStore(s => s.customTextColor)
actions.sync(payload, 1)
// @ts-expect-error Baked sync accepts a numeric revision.
actions.sync(payload, 'invalid')
// @ts-expect-error Baked sync requires the complete settings payload.
actions.sync({ enabled: true }, 2)
// @ts-expect-error The draft parameter is not exposed on the bound action.
actions.sync(handle.spec.init(), payload, 2)
// @ts-expect-error State selectors cannot access undeclared properties.
props.useStore(s => s.nonexistent)
// @ts-expect-error Selector results retain their field types.
const invalidBlur: string = props.useStore(s => s.blur)

// Generic adapter calls still infer the draft and strip it from bound callbacks.
const counter = defineStore({
  init: () => ({ count: 0, label: '' }),
  actions: {
    add: (draft, amount: number) => { draft.count += amount },
    rename: (draft, label: string) => { draft.label = label },
  },
})
declare const counterActions: BoundActions<typeof counter>
declare const counterProps: PropsStore<typeof counter>
counterActions.add(2)
counterActions.rename('valid')
const count: number = counterProps.useStore(s => s.count)
// @ts-expect-error Generic bound action parameters cannot degrade to any.
counterActions.add('invalid')
// @ts-expect-error The second generic action keeps its string parameter.
counterActions.rename(123)
// @ts-expect-error Generic selectors reject unknown fields.
counterProps.useStore(s => s.missing)

void [registrationStore, enabled, blur, customTextColor, invalidBlur, count]

// Published declaration consumers must see the same handle/action/selector face.
type PublishedHandle = ReturnType<typeof PublishedCreateStore>
declare const publishedHandle: PublishedHandle
declare const publishedActions: BoundActions<PublishedHandle>
declare const publishedProps: PropsStore<PublishedHandle>
const publishedRegistration: StoreDecl = publishedHandle
const publishedEnabled: boolean = publishedProps.useStore(s => s.enabled)
publishedActions.sync(payload, 4)
// @ts-expect-error Published action declarations must retain numeric revisions.
publishedActions.sync(payload, 'invalid')
// @ts-expect-error Published selectors reject undeclared fields.
publishedProps.useStore(s => s.missing)
void [publishedRegistration, publishedEnabled]
