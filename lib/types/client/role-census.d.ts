/**
 * Role census — the coverage engine for Mineradio 3.0.
 *
 * WHY THIS EXISTS
 * The 2.x theme decided coverage from CSS class-name word roots
 * (`[class*='panel']`, `[class*='bar']`, …) at a fixed (0,2,0) specificity.
 * Measured against the real 0.2.0-rc.2 shell that approach loses: the shell
 * paints `--dsw-alias-bg-base` on `._tabHost_…:not(._float_…)`,
 * `._emptyTabHost_…`, `._tabCell_…`, `._paneBody_…`, `._stripChrome_…`,
 * `._backing_…` — roots the word list never learned — and any host rule above
 * (0,2,0) wins outright. That is why a black plate survived every release.
 * See outputs/harness/mechanism-test.mjs for the measurement.
 *
 * WHAT IT DOES INSTEAD
 * It reads what each element actually PAINTS (computed style + geometry), gives
 * it a ROLE, and stamps that role as an attribute. The stylesheet then targets
 * roles, with `!important` so the declaration wins on priority rather than on a
 * specificity contest it cannot reliably win.
 *
 * Faces the theme has already hand-dressed are left alone: they carry the
 * family rim (`inset 0 0 0 1px …`), and re-dressing them is exactly the
 * regression that flattened the session header card.
 *
 * Everything here is measured; nothing is inferred from a class name.
 */
/** Role stamp written by the census. */
export declare const ROLE_ATTRIBUTE = "data-md-role";
/** Marks a face that also joins the spotlight/tilt set. */
export declare const SPOT_ATTRIBUTE = "data-md-spot";
/** Opt-out for a single element (host or user). */
export declare const IGNORE_ATTRIBUTE = "data-md-ignore";
/** Roles, in increasing order of "how much glass it should wear". */
export type Role = 'ground' | 'structure' | 'pane' | 'overlay' | 'control' | 'chip';
export declare const ROLES: readonly Role[];
interface Policy {
    /** Minimum width in px for an element to count as a face. */
    minWidth: number;
    /** Minimum height in px. */
    minHeight: number;
    /** Minimum area in px². */
    minArea: number;
    /** A background this opaque counts as "paints something". */
    paintAlpha: number;
    /** Share of the viewport above which an in-flow slab is structural ground. */
    groundRatio: number;
    /** Share of the viewport above which an in-flow painted slab is structure. */
    structureRatio: number;
    /** Above this area a pane also joins the spotlight set. */
    spotArea: number;
    /** Below this area a painted face is a chip (glass sliver, no blur). */
    chipArea: number;
    /** Per-frame time budget in ms for the census loop. */
    frameBudgetMs: number;
}
export declare const POLICY: Policy;
export interface CensusStats {
    /** Elements measured so far. */
    measured: number;
    /** Elements currently carrying a role stamp. */
    stamped: number;
    /** Faces the census refused to touch because they already wear the rim. */
    handDressed: number;
    /** Queued elements not yet decided. */
    pending: number;
    /** Role tally. */
    byRole: Record<Role, number>;
}
export interface CensusHandle {
    /** Re-run a full census (state changed without a DOM mutation). */
    rescan(): void;
    /** Current counters. */
    stats(): CensusStats;
    /** Stop and remove every stamp this module owns. */
    dispose(): void;
}
/**
 * Parse the alpha channel out of any CSS colour the engine can produce.
 *
 * Chrome resolves `color-mix()` to `color(srgb r g b / a)`, and the shell uses
 * `color-mix()` for its menu and overlay fills — a parser that only understood
 * `rgb()/rgba()` read those as alpha 0 and skipped them, which is how the
 * agent-team popover escaped coverage. Handles rgb/rgba (comma and slash),
 * `color(srgb …)`, `oklch()`, `#rgb/#rrggbb/#rrggbbaa`, `hsl()`, `transparent`
 * and percentage alpha.
 */
export declare function alphaOf(value: string): number;
/** Marks a face whose visible plate is painted by a covering pseudo-element. */
export declare const VEIL_ATTRIBUTE = "data-md-veil";
/**
 * Start the role census.
 * @returns handle with rescan/stats/dispose.
 */
export declare function startRoleCensus(): CensusHandle;
export {};
