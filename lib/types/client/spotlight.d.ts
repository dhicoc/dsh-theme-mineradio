/** html attribute the layer uses to switch the glow effect (its toggle). */
export declare const SPOTLIGHT_ATTRIBUTE = "data-dsh-aqua-spotlight";
/** html attribute the layer uses to switch the tilt effect (its toggle). */
export declare const PRESS_ATTRIBUTE = "data-dsh-aqua-press";
/**
 * Attach the delegated pointer feeds. Everything is document-level: no
 * per-pane listeners, and the rAF merge collapses pointermove bursts to one
 * style write per frame.
 * @returns a disposer that drops listeners, overlays, and inline styles.
 */
export declare function startSpotlight(): () => void;
