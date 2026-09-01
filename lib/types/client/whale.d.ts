/**
 * Particle whale: the deepseek.com/harness hero's centerpiece fish rendered
 * as particles — a faithful 2D port of the site's `HeroDigitileR3F` (chunk
 * 776) minus three.js. The 24×18 brand-fish SVG is sampled onto a 60×60
 * luminance grid, the particles scatter, then assemble into the silhouette
 * with the site's drift / tail-sway / light-shading / pointer-push math.
 * Additive canvas blending + `mix-blend-mode: screen` (as on the site).
 */
/** Whale handle: scheme updates plus disposal. */
export interface WhaleHandle {
    /** Flip the particle color between the dark (white) and light (gray) sets. */
    setDark: (dark: boolean) => void;
    /** Stop the engine and remove the DOM. */
    dispose: () => void;
}
/**
 * Mount the particle whale into `host` (the ambient scene) and start the
 * engine. The wrapper is centered on the MAIN column — the `[data-phase]`
 * conversation area, i.e. everything right of the sidebar — not the whole
 * viewport.
 * @param host - the container the whale wrapper is appended to.
 * @param dark - resolved scheme at mount (white particles on dark, gray on light).
 * @returns the handle.
 */
export declare function mountWhale(host: HTMLElement, dark: boolean): WhaleHandle;
