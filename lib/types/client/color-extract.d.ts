/**
 * Wallpaper color extraction — a small, dependency-free dominant-hue finder.
 *
 * The wallpaper (image or video frame) is drawn onto a tiny canvas, and the
 * pixels are folded into a circular hue histogram weighted by saturation and
 * mid-lightness, so gray/black/white areas contribute nothing and the result
 * is the image's most vivid, representative hue. Returns a single hue in
 * degrees (0-360), or null when the source is too desaturated to read.
 */
/**
 * Extract the dominant hue from a canvas-image source (img / video / canvas).
 * @returns a hue in degrees, or null when the source yields no vivid color.
 */
export declare function extractDominantHue(source: CanvasImageSource): number | null;
