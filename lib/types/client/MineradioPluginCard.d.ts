import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots';
import type { createMineradioRowStore } from './settings-store.ts';
/** Injected business face: the master enable write. */
export interface MineradioPluginCardInjected {
    /** Switch the glass layer on or off. */
    setEnabled: (enabled: boolean) => void;
}
/** Full component props: runtime share + store share + locale seat + injected face. */
export type MineradioPluginCardComponentProps = PropsRuntime<'settings.plugin.item'> & PropsStore<ReturnType<typeof createMineradioRowStore>> & PropsLocale<'settings.mineradio'> & InjectFace<MineradioPluginCardInjected>;
/**
 * Render the Mineradio plugin card.
 * @param props - composed slot props.
 * @returns the card list item.
 */
export declare function MineradioPluginCard(props: MineradioPluginCardComponentProps): import("react").JSX.Element;
