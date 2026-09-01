/**
 * Continuous fluid palette: hue (0-360) and depth (0-100) sliders drive the
 * shader colors directly through HSL interpolation — stepless, no preset
 * steps. Depth 0 = the deep, saturated version of the hue (e.g. #8B0000 for
 * red), depth 100 = the pale, light version (e.g. #FFCCCB); the deep base
 * stop stays near-neutral so the colorless areas keep their true color.
 */
export interface FluidToneColors {
    /** Bright bloom stop. */
    color1: string;
    /** Mid wash stop. */
    color2: string;
    /** Deep base stop (near-neutral). */
    color3: string;
}
/** The slider's 0/360 lands directly on the hue (HUE_BASE 0 keeps the
 *  Mineradio default at 44 = champagne gold), sweeping clockwise around the
 *  wheel — 44 lands on warm amber, 180 on mint. */
export declare const HUE_BASE = 0;
/**
 * Palette for the given hue (0-360) and depth (0-100), per scheme.
 * The depth ramp is piecewise: the lower half sweeps from the absolute
 * extreme — pure black in dark mode, the deep saturated shade (e.g. #8B0000
 * for red) in light mode — up to the shipped mid look; the upper half
 * sweeps from mid to pale (#FFCCCB for red). Stepless HSL interpolation.
 */
export declare function fluidToneColors(dark: boolean, hue: number, depth: number): FluidToneColors;
/** Vivid, fixed-lightness colour for a hue — used to fill the rainbow-strip
 *  thumb so it always shows the picked colour in dark and light mode alike. */
export declare function fluidHueSwatch(hue: number): string;
