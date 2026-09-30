/**
 * Mineradio card registered into the Plugins settings section's tab ledger
 * (`settings.plugins.tab` in 0.2.0-rc.2; the 0.1.x `settings.plugin.item`
 * card slot is gone): the master on/off switch — name, description, and
 * one toggle. Every other knob lives in the General settings' Appearance
 * row, so the card stays the same shape as the other plugin pages.
 */
import { IconCheckOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the `settings.plugins.tab` SlotMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type { createMineradioRowStore } from './settings-store.ts'
import css from './MineradioPluginCard.module.css'

/** Injected business face: the master enable write. */
export interface MineradioPluginCardInjected {
  /** Switch the glass layer on or off. */
  setEnabled: (enabled: boolean) => void
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type MineradioPluginCardComponentProps =
  PropsRuntime<'settings.plugins.tab'> & PropsStore<ReturnType<typeof createMineradioRowStore>>
  & PropsLocale<'settings.mineradio'> & InjectFace<MineradioPluginCardInjected>

/**
 * Render the Mineradio plugin card.
 * @param props - composed slot props.
 * @returns the card list item.
 */
export function MineradioPluginCard(props: MineradioPluginCardComponentProps) {
  const { t, setEnabled, useStore } = props
  const enabled = useStore(s => s.enabled)
  return (
    <li className={css.card}>
      <div className={css.head}>
        <div className={css.text}>
          <div className={css.title}>{t('mineradio.title')}</div>
          <div className={css.description}>{t('mineradio.description')}</div>
        </div>
        <button
          type="button"
          className={css.toggle}
          aria-pressed={enabled}
          onClick={() => { setEnabled(!enabled) }}
        >
          <span className={css.check}>
            {enabled && <IconCheckOutlineRegular size={16} />}
          </span>
          {enabled ? t('mineradio.enable') : t('mineradio.disable')}
        </button>
      </div>
    </li>
  )
}
