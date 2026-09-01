import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots';
import type { createMineradioRowStore } from './settings-store.ts';
import { type PerfTier, type ScenePreset, type TextStyle } from './theme-layer.ts';
/** Injected business face: every knob write except the master switch. */
export interface MineradioAppearanceRowInjected {
    /** Apply a named scene preset (existing knobs only). */
    applyScene: (value: ScenePreset) => void;
    /** Set the performance gate. */
    setPerf: (value: PerfTier) => void;
    /** Set the rendering mode. */
    setMode: (value: 'mica' | 'compat') => void;
    /** Set the global text-ink preset. */
    setTextStyle: (value: TextStyle) => void;
    /** Set the glass blur radius, px. */
    setBlur: (value: number) => void;
    /** Set the glass frost amount, 0-100. */
    setFrost: (value: number) => void;
    /** Set the fluid hue, degrees (0-360, continuous). */
    setFluidHue: (value: number) => void;
    /** Set the fluid depth, 0-100 (continuous). */
    setFluidDepth: (value: number) => void;
    /** Set the glass dispersion tint hue, degrees (0-360, continuous). */
    setDispersionHue: (value: number) => void;
    /** Set the glass refraction strength, 0-100. */
    setDispersionRefract: (value: number) => void;
    /** Set the background brightness, 0-100 (0 = black, 50 = transparent, 100 = white). */
    setBgBrightness: (value: number) => void;
    /** Set the backdrop source. */
    setBackground: (value: 'fluid' | 'wallpaper') => void;
    /** Set the wallpaper image (a data URL). */
    setWallpaper: (value: string) => void;
    /** Set the wallpaper auto-tint flag (derive accent hues from the wallpaper). */
    setAutoTint: (value: boolean) => void;
    /** Set the particle-whale flag. */
    setWhale: (value: boolean) => void;
    /** Set the ambient marine-life flag. */
    setCritters: (value: boolean) => void;
    /** Set the interactive-mesh flag. */
    setMesh: (value: boolean) => void;
    /** Set the star-river particle density, 0-100. */
    setStarDensity: (value: number) => void;
    /** Set the cursor-spotlight flag. */
    setSpotlight: (value: boolean) => void;
    /** Set the hover-press flag. */
    setPress: (value: boolean) => void;
    /** Set the audio-reactivity flag (mic-driven backdrop pulse). */
    setAudioReact: (value: boolean) => void;
    /** Set the wallpaper blur radius, px. */
    setWallpaperBlur: (value: number) => void;
    /** Set the wallpaper frost veil, 0-100. */
    setWallpaperFrost: (value: number) => void;
    /** Set the wallpaper frost-mask flag (readability veil + stronger blur). */
    setWallpaperMask: (value: boolean) => void;
    /** Set the frost-mask blur radius, px. */
    setWallpaperMaskBlur: (value: number) => void;
    /** Set the frost-mask veil opacity, 0-100. */
    setWallpaperMaskOpacity: (value: number) => void;
    /** Set the video wallpaper blur radius, px. */
    setVideoBlur: (value: number) => void;
    /** Set the video wallpaper brightness, 0-100. */
    setVideoBrightness: (value: number) => void;
    /** Re-read the fsa: video after the user re-granted file access. */
    authorizeVideo: () => void;
}
/** Full component props: runtime share + store share + locale seat + injected face. */
export type MineradioAppearanceRowComponentProps = PropsRuntime<'settings.general.item'> & PropsStore<ReturnType<typeof createMineradioRowStore>> & PropsLocale<'settings.mineradio'> & MineradioAppearanceRowInjected;
/**
 * Render the Mineradio appearance row.
 * @param props - composed slot props.
 * @returns the General section row.
 */
export declare function MineradioAppearanceRow(props: MineradioAppearanceRowComponentProps): import("react").JSX.Element | null;
