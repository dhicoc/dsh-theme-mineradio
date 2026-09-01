/**
 * Station dial — every workspace is its own radio station.
 *
 * The sidebar's workspace rows (`.projectRow`) name the station. Each name
 * maps to a stable hue offset from a curated set of warm-adjacent stops,
 * remembered in localStorage; switching workspaces glides the fluid, glow
 * and dispersion tints there over ~2 seconds — like tuning a radio dial.
 * The brand row carries a tiny frequency window (`FM 044`) that flickers
 * while tuning. No settings knob: this is the radio being a radio.
 *
 * Resolution walks the flat ARIA tree: sessions are `.sessionRow` siblings
 * that follow their workspace's `.projectRow`, so "the nearest projectRow
 * at-or-before the selected session" names the station. Hero phase (no
 * selection) keeps whatever was tuned last.
 */
/** The station name: nearest `.projectRow` at-or-before the selected session. */
export declare function resolveStationName(): string | null;
/**
 * Watch the sidebar and retune when the station changes.
 * @param onOffset called with the interpolated offset each frame of a tune
 *   (and once at boot/settle), so the layer can repaint fluid + accents.
 * @returns a disposer that disconnects the observer and cancels any glide.
 */
export declare function startStationDial(onOffset: (offset: number) => void): () => void;
