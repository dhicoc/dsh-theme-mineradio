/**
 * Mineradio-style particle stage — a from-scratch Canvas 2D re-creation of the
 * music player's signature backdrop motion (no code copied from the player):
 *
 *   1. STAR RIVER — hundreds of dust points organised in horizontal "bands"
 *      that drift sideways while sine waves carry them up/down. Cool
 *      blue→violet particles with a warm champagne ridge per band, plus a
 *      slow twinkle. Reads as a slow galaxy river flowing behind the glass.
 *   2. POINTER FIELD — particles near the cursor brighten and swell, like
 *      the player's silk cover reacting to the mouse.
 *   3. RIPPLES — a click drops a ripple: particles ride the expanding ring
 *      outwards and flash brighter, then everything settles back.
 *
 * Performance discipline: fixed particle cap, DPR capped at 1.5, sprite-based
 * rendering (one pre-baked radial dot per colour, no per-particle gradients),
 * `requestAnimationFrame` loop paused on `visibilitychange`, and a single
 * static frame under `prefers-reduced-motion`.
 */
/** Public knob: dark scheme runs the full galaxy, light scheme dims it. */
export interface StarRiverOptions {
    dark: boolean;
    /** Particle density, 0-100 (50 = 1× the default field, 100 = 2×). */
    density?: number;
    /** Respect the OS reduced-motion preference by rendering one static frame
     *  instead of animating. OFF by default: the star river is the skin's
     *  signature motion, so it animates unless an app-level switch opts in to
     *  accessibility static frames. */
    respectReducedMotion?: boolean;
}
/** Handle returned by {@link mountStarRiver}. */
export interface StarRiverHandle {
    /** Update the scheme knob. */
    setDark(dark: boolean): void;
    /** Update the particle density (0-100) and rebuild the field live. */
    setDensity(density: number): void;
    /** Audio reactivity: bass `low` drives the hop, treble `high` the sparkle. */
    setAudio(low: number, high: number): void;
    /** Tear the stage down (canvas, listeners, animation). */
    dispose(): void;
}
/** Mount the particle stage inside the ambient container. Idempotent: a
 *  second call reuses the existing canvas. */
export declare function mountStarRiver(ambient: HTMLElement, options: StarRiverOptions): StarRiverHandle;
