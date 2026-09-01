/**
 * Mineradio row slot store: a mirror of the layer's state (enable flag plus the
 * knobs and the backdrop source). The plugin's apply-world change listener is
 * the only writer; the row component reads via props.useStore.
 */
import { type EngineStoreHandle } from '@deepseek-ai/dsh-client-store';
import type { PerfTier, TextStyle } from './theme-layer.ts';
/** Store state mirrored from the Mineradio settings scope. */
export interface MineradioRowState {
    /** Persisted layer enable flag. */
    enabled: boolean;
    /** Rendering mode: mica or stock layout with generic glass. */
    mode: 'mica' | 'compat';
    /** Global text-ink tint preset. */
    textStyle: TextStyle;
    /** Glass blur radius, px. */
    blur: number;
    /** Glass frost amount, 0-100. */
    frost: number;
    /** Fluid hue, degrees (0-360, continuous). */
    fluidHue: number;
    /** Fluid depth, 0-100 (continuous). */
    fluidDepth: number;
    /** Glass dispersion tint hue, degrees (0-360, continuous). */
    dispersionHue: number;
    /** Glass refraction strength, 0-100. */
    dispersionRefract: number;
    /** Background brightness, 0-100. */
    bgBrightness: number;
    /** Resolved palette is dark (brightness knob = darkening half). */
    dark: boolean;
    /** Backdrop source: fluid board or custom wallpaper. */
    background: 'fluid' | 'wallpaper';
    /** Wallpaper image data URL. */
    wallpaper: string;
    /** Auto-derive the accent hue from the wallpaper. */
    autoTint: boolean;
    /** Particle whale in the chat area center. */
    whale: boolean;
    /** Ambient star particles. */
    critters: boolean;
    /** Interactive mesh (the site's dot-grid with pointer repel). */
    mesh: boolean;
    /** Star-river particle density, 0-100. */
    starDensity: number;
    /** Cursor spotlight glow following the pointer over the glass panes. */
    spotlight: boolean;
    /** Hover press-down for the glass panes. */
    press: boolean;
    /** Audio reactivity (mic-driven backdrop pulse). */
    audioReact: boolean;
    /** Wallpaper blur radius, px. */
    wallpaperBlur: number;
    /** Wallpaper frost veil, 0-100. */
    wallpaperFrost: number;
    /** Frosted-glass mask over the wallpaper (readability veil + stronger blur). */
    wallpaperMask: boolean;
    /** Frost mask blur radius, px. */
    wallpaperMaskBlur: number;
    /** Frost mask veil opacity, 0-100. */
    wallpaperMaskOpacity: number;
    /** Video wallpaper blur radius, px. */
    videoBlur: number;
    /** Video wallpaper brightness, 0-100. */
    videoBrightness: number;
    /** Performance gate. */
    perf: PerfTier;
    /** Rainbow fluid drift. */
    rainbow: boolean;
    /** Monotonic revision; -1 until first sync so revision 0 lands as a change. */
    revision: number;
}
/** The full payload the layer pushes into the row store on every change. */
export interface MineradioSettingsPayload {
    enabled: boolean;
    mode: 'mica' | 'compat';
    textStyle: TextStyle;
    blur: number;
    frost: number;
    fluidHue: number;
    fluidDepth: number;
    dispersionHue: number;
    dispersionRefract: number;
    bgBrightness: number;
    dark: boolean;
    background: 'fluid' | 'wallpaper';
    wallpaper: string;
    autoTint: boolean;
    whale: boolean;
    critters: boolean;
    mesh: boolean;
    starDensity: number;
    spotlight: boolean;
    press: boolean;
    audioReact: boolean;
    wallpaperBlur: number;
    wallpaperFrost: number;
    wallpaperMask: boolean;
    wallpaperMaskBlur: number;
    wallpaperMaskOpacity: number;
    videoBlur: number;
    videoBrightness: number;
    perf: PerfTier;
    rainbow: boolean;
}
/** Declared action shape giving the exported factory a stable return type. */
type MineradioRowActions = {
    sync: (draft: MineradioRowState, next: MineradioSettingsPayload, revision: number) => void;
};
/**
 * Declares the Mineradio row state and write surface.
 * @returns the store handle.
 */
export declare function createMineradioRowStore(): EngineStoreHandle<MineradioRowState, MineradioRowActions>;
export {};
