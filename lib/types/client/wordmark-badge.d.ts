/**
 * Wordmark badge swap: in DARK mode the DSH wordmark's solid "HARNESS"
 * plate (`<rect x="129.348" .../>` + knocked-out letterforms) is replaced
 * at runtime with the official deepseek.com/harness nameplate — the glossy
 * "Harness" pill (gradient ring + soft glow + black/25 pill with white/95
 * mono text). In LIGHT mode the stock plate stays exactly as shipped. The
 * plate box inside the svg is measured and the pill is positioned over the
 * letterform slot, so it tracks the wordmark through sidebar expand /
 * collapse, width resizes, and late layout. Everything is removed on
 * dispose: off == the stock wordmark exactly.
 */
/** Badge handle: scheme updates plus disposal. */
export interface BadgeHandle {
    /** Dark mode wears the official pill; light mode keeps the stock plate. */
    setDark: (dark: boolean) => void;
    /** Stop observing and restore the stock wordmark. */
    dispose: () => void;
}
/**
 * Decorate every stamped wordmark button and keep it decorated as React
 * remounts nodes or the layout settles.
 * @param dark - resolved scheme at mount.
 * @returns the handle.
 */
export declare function startWordmarkBadge(dark: boolean): BadgeHandle;
