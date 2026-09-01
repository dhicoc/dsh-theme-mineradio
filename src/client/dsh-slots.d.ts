/**
 * Local Context augmentation for the `slots` service.
 *
 * The alpha.2 line ships the slots service at runtime (the web frontend's
 * platform seed provides `ctx.slots`, and core client packages call
 * `ctx.slots.inject/register`) but does not augment `@deepseek-ai/cordis`'s
 * `Context` in the published `dsh-client-ui-slots` types. This plugin declares
 * the seat it consumes so it typechecks standalone; the runtime contract comes
 * from the host, unchanged.
 */
import type { SlotCore } from '@deepseek-ai/dsh-client-ui-slots'

declare module '@deepseek-ai/cordis' {
  interface Context {
    slots: SlotCore & {
      inject: (
        name: string,
        register: () => unknown,
        options?: { key?: string },
      ) => unknown
    }
  }
}
