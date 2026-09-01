/**
 * Mineradio glass dispersion filter — a reworked, single-tint port of the
 * player's `mineradio-control-glass-filter`.
 *
 * The original couples refraction and RGB channel split (which screen-blends
 * into an ugly magenta/purple). Here the two are separated:
 *
 *   - REFRACTION: a colourless `feDisplacementMap` warps the backdrop through
 *     a generated noise map (a blurred rounded-rect "clear centre" + red/blue
 *     gradients), so the things behind the glass visibly bend at the edges.
 *   - EDGE TINT: the refracted backdrop is laterally shifted and differenced
 *     against itself (`feBlend mode="difference"`), which isolates the edge
 *     signal only; a `feColorMatrix` then fills that signal with a SINGLE
 *     user-picked hue, luminance-driven alpha (so it stays transparent and
 *     edge-only), screen-blended over the refraction.
 *
 * The tint hue is adjustable at runtime via `setTint(hue)`. Chromium-only
 * (SVG `url()` in `backdrop-filter` is unsupported by Safari/Firefox); the
 * layer keeps its plain blur fallback there.
 */
export interface GlassDispersionHandle {
    /** Re-colour the edge tint (hue in degrees, continuous). */
    setTint(hue: number): void;
    /** Set the refraction strength (0-100 — the feDisplacementMap scale). */
    setRefraction(scale: number): void;
    dispose(): void;
}
/** Start the glass dispersion filter and stamp the enabling attribute. */
export declare function startGlassDispersion(): GlassDispersionHandle;
