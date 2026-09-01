/**
 * the Mineradio layer: one toggleable visual skin over the whole Web surface.
 * Everything this layer owns is an effect — token overrides ride the theme
 * service's override stack, the CSS hooks ride a `data-dsh-aqua` attribute on
 * <html> (the stylesheet only applies under it), the ambient scene and page
 * fades are mounted/removed with the layer — so switching the flag off (or
 * unloading the plugin) restores the stock UI exactly: no residue, no reload.
 *
 * The enable flag persists in localStorage: a client-only visual preference
 * (like the selected-session key), written and read by this plugin alone.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { ThemeTokenOverrides } from '@deepseek-ai/dsh-client-ui-theme/client';
/** html attribute selecting the Mineradio layer: CSS hooks and ambient effects.
 *  Kept as the internal `data-dsh-aqua` seam so the stylesheet's 100+ gated
 *  selectors and the helper modules stay consistent across the skin. */
export declare const MINERADIO_ATTRIBUTE = "data-dsh-aqua";
/** localStorage key carrying the layer enable flag. */
export declare const MINERADIO_ENABLED_KEY = "dsh.ui-mineradio.enabled";
/** Default state when nothing is stored yet: on. */
export declare const DEFAULT_ENABLED = true;
/**
 * Alias-token override layer: the Mineradio "cinema gold" palette. Every
 * value is a `{ light, dark }` pair so the layer stays legible when the user
 * switches the Appearance preference — dark is the near-black studio
 * ({INK}), light is a warm paper white. The brand accent is champagne gold
 * with mint + ember rose echoes, straight from the Mineradio wordmark.
 */
export declare const MINERADIO_TOKEN_OVERRIDES: ThemeTokenOverrides;
/** Preset global text-ink tints: the "text colour" switch swaps the warm
 *  champagne ink for a neutral / mint / rose tint while keeping the SAME
 *  lightness ladder, so every preset stays readable in either scheme. The
 *  champagne preset reproduces the shipped values exactly (no regression). */
export type TextStyle = 'champagne' | 'neutral' | 'mint' | 'rose';
/** Tunable layer knobs, persisted independently of the enable flag. */
export interface MineradioSettings {
    /** Rendering mode: mica (frosted floating cards) or the stock layout with a generic glass material. */
    mode: 'mica' | 'compat';
    /** Global text-ink tint: warm champagne (default) or a neutral/mint/rose. */
    textStyle: TextStyle;
    /** Glass backdrop blur radius, px. */
    blur: number;
    /** Glass fill opacity, 0-100 (50 = the shipped look; drives the frost multiplier). */
    frost: number;
    /** Fluid hue, degrees (0-360, continuous). */
    fluidHue: number;
    /** Fluid depth, 0-100 (0 = deep saturated, 100 = pale light, continuous). */
    fluidDepth: number;
    /** Glass dispersion tint hue, degrees (0-360, continuous). */
    dispersionHue: number;
    /** Glass refraction strength, 0-100 (0 = none, 100 = strong). */
    dispersionRefract: number;
    /** Background brightness, 0-100 (0 = pure black, 50 = transparent, 100 = pure white). */
    bgBrightness: number;
    /** Backdrop source: the living fluid board or a custom wallpaper. */
    background: 'fluid' | 'wallpaper';
    /** Wallpaper image data URL (empty until one is picked). */
    wallpaper: string;
    /** Auto-derive the accent hue from the wallpaper (spotlight/bloom/dispersion). */
    autoTint: boolean;
    /** Particle whale in the chat area center (opt-in extra; off by default —
     *  the Mineradio star river is the shipped particle stage). */
    whale: boolean;
    /** Ambient marine life (fish / bubbles / plankton). */
    critters: boolean;
    /** Interactive mesh (the site's dot-grid with pointer repel). */
    mesh: boolean;
    /** Star-river particle density, 0-100 (50 = 1×, 100 = 2× the default field). */
    starDensity: number;
    /** Cursor spotlight glow that follows the pointer over the glass panes. */
    spotlight: boolean;
    /** Hover press-down: the pane under the cursor sinks a touch (tactile depth). */
    press: boolean;
    /** Audio reactivity: the backdrop pulses with mic audio (fluid/stars/glow). */
    audioReact: boolean;
    /** Wallpaper blur radius, px. */
    wallpaperBlur: number;
    /** Wallpaper frost veil, 0-100. */
    wallpaperFrost: number;
    /** Frosted-glass mask over the wallpaper (readability veil + stronger blur). */
    wallpaperMask: boolean;
    /** Frost mask blur radius, px (0 = none, 40 = heavy frosted glass). */
    wallpaperMaskBlur: number;
    /** Frost mask veil opacity, 0-100 (0 = clear, 100 = fully opaque scrim). */
    wallpaperMaskOpacity: number;
    /** Video wallpaper blur radius, px (0 = crisp, 40 = heavy acrylic). */
    videoBlur: number;
    /** Video wallpaper brightness, 0-100 (100 = fully lit, 0 = deepest dim). */
    videoBrightness: number;
    /** Performance gate: which motion layers actually run. Orthogonal to scenes. */
    perf: PerfTier;
    /** Optional rainbow fluid drift. Off by default; does not rewrite fluidHue. */
    rainbow: boolean;
}
/** Performance gate. Scenes keep their knob values; this only mounts layers. */
export type PerfTier = 'performance' | 'balanced' | 'vivid';
/** One-click scene: a named bundle of existing knobs (never the wallpaper). */
export type ScenePreset = 'studio' | 'deepsea' | 'midnight' | 'mist' | 'rainbow';
/** Knob bundle for one scene. Wallpaper / video files stay untouched. */
type SceneBundle = Pick<MineradioSettings, 'textStyle' | 'blur' | 'frost' | 'fluidHue' | 'fluidDepth' | 'dispersionHue' | 'dispersionRefract' | 'starDensity' | 'spotlight' | 'press' | 'audioReact' | 'background' | 'rainbow'>;
/** Which scene the current knobs match, or null after a manual tweak. */
export declare function matchScenePreset(settings: Pick<MineradioSettings, keyof SceneBundle>): ScenePreset | null;
/**
 * Owns the Mineradio layer lifecycle: reads the durable enable flag, and applies /
 * retracts every layer on change. Cross-tab flips arrive through the storage
 * event; every subscription and mounted effect are released when the plugin
 * fiber is disposed.
 */
export declare class MineradioLayer {
    private enabled;
    private settings;
    /** Resolved palette scheme: dark = the brightness knob darkens, light = it brightens. */
    private dark;
    private tokenDisposer;
    private mainFluid;
    private interactionDisposer;
    private themeListener;
    private seamDisposer;
    private spotlightDisposer;
    private whaleHandle;
    private meshHandle;
    private starRiverHandle;
    private audioHandle;
    private cinemaDrift;
    private dispersion;
    private specularParallaxDisposer;
    /** Object URL of the current large-video wallpaper (revoked on replace). */
    private videoObjectUrl;
    /** IndexedDB id backing the current object URL (guards against reloads). */
    private videoBlobId;
    /** Extracted accent hue from the wallpaper (undefined until read). */
    private extractedHue;
    /** Wallpaper source the extracted hue was computed from (guards re-reads). */
    private extractedWallpaper;
    /** Live rainbow hue, only while the rainbow scene is on. Not persisted. */
    private rainbowHue;
    private rainbowRaf;
    /** Station dial: per-workspace hue offset, glided by station-dial.ts. */
    private stationOffset;
    private stationDisposer;
    private readonly ctx;
    /**
     * @param ctx - owning client context.
     */
    constructor(ctx: Context);
    /** Current enable state (the settings row mirrors this). */
    getEnabled(): boolean;
    /** Current knob values (the settings row mirrors these). */
    getSettings(): MineradioSettings;
    /** Whether the resolved palette is dark (the brightness knob darkens). */
    getDark(): boolean;
    /** Resolved scheme from the theme service (falls back to the body attribute). */
    private resolveScheme;
    /** Re-read every knob from localStorage into memory. */
    private reloadSettings;
    /** Set the performance gate (does not rewrite scene knobs). */
    setPerf(value: PerfTier): void;
    /** Apply one named scene. Wallpaper / video files stay as they are. */
    applyScene(preset: ScenePreset): void;
    /** Flip the layer: persist, then apply or retract every owned effect. */
    setEnabled(value: boolean): void;
    /** Set the rendering mode ('mica' or 'compat'). */
    setMode(value: 'mica' | 'compat'): void;
    /** Set the global text-ink preset ('champagne' | 'neutral' | 'mint' | 'rose'). */
    setTextStyle(value: TextStyle): void;
    /** Set the glass blur radius (px). */
    setBlur(value: number): void;
    /** Set the glass frost amount (0-100). */
    setFrost(value: number): void;
    /** Set the fluid hue (degrees, continuous). */
    setFluidHue(value: number): void;
    /** Set the glass dispersion tint hue (degrees, continuous). */
    setDispersionHue(value: number): void;
    /** Set the glass refraction strength (0-100). */
    setDispersionRefract(value: number): void;
    /** Set the fluid depth (0-100, continuous: deep ↔ pale). */
    setFluidDepth(value: number): void;
    /** Set the background brightness (0-100: 0 = pure black, 50 = transparent, 100 = pure white). */
    setBgBrightness(value: number): void;
    /** Set the backdrop source (fluid board or custom wallpaper). */
    setBackground(value: 'fluid' | 'wallpaper'): void;
    /** Set the wallpaper image (a data URL; empty clears it) or a large video
     *  (`idb:<id>` marker whose blob lives in IndexedDB). */
    setWallpaper(value: string): void;
    /** Set the wallpaper auto-tint flag (derive accent hues from the wallpaper). */
    setAutoTint(value: boolean): void;
    /** Set the particle-whale flag (chat-area center decoration). */
    setWhale(value: boolean): void;
    /** Set the ambient marine-life flag (fish / bubbles / plankton). */
    setCritters(value: boolean): void;
    /** Set the interactive-mesh flag (dot-grid decoration). */
    setMesh(value: boolean): void;
    /** Set the star-river particle density (0-100). */
    setStarDensity(value: number): void;
    /** Set the cursor-spotlight flag (pointer-tracking glass glow). */
    setSpotlight(value: boolean): void;
    /** Set the hover-press flag (pane sinks a touch under the cursor). */
    setPress(value: boolean): void;
    /** Set the audio-reactivity flag (mic-driven backdrop pulse). */
    setAudioReact(value: boolean): void;
    /** Set the wallpaper blur radius (px). */
    setWallpaperBlur(value: number): void;
    /** Set the wallpaper frost veil (0-100). */
    setWallpaperFrost(value: number): void;
    /** Set the wallpaper frost-mask flag (readability veil + stronger blur). */
    setWallpaperMask(value: boolean): void;
    /** Set the frost-mask blur radius (px). */
    setWallpaperMaskBlur(value: number): void;
    /** Set the frost-mask veil opacity (0-100). */
    setWallpaperMaskOpacity(value: number): void;
    /** Set the video wallpaper blur radius (px). */
    setVideoBlur(value: number): void;
    /** Set the video wallpaper brightness (0-100, 100 = fully lit). */
    setVideoBrightness(value: number): void;
    /** After the user re-grants file access (选择视频 click on an fsa: video),
     *  drop the mount guard and re-apply so the file is re-read and played. */
    authorizeVideo(): void;
    private sync;
    /** Write the knob-driven CSS variables and mode attributes onto <html>. */
    private applySettings;
    /** The wallpaper plays as a plain <video> element (the browser's own
     *  decoder, no player chrome at all): looping on, cover fill via CSS, and
     *  autoplay with a muted fallback where policy requires it. A direct
     *  element (not an iframe) keeps backdrop-filter working over it, so the
     *  glass panels stay frosted above the video. */
    private configureWallpaperVideo;
    /** The hue driving the spotlight glow + ambient bloom right now. */
    private accentHue;
    /** The dispersion edge-tint hue (auto-extracted, or the user's knob). */
    private dispersionTintHue;
    /** Write the hue-driven accent vars (spotlight glow + bloom + dispersion). */
    private applyAccentTint;
    /** Kick off (or clear) wallpaper color extraction, guarded by source. */
    private ensureWallpaperTint;
    /** Extract the dominant hue and repaint the accents (async, guarded). */
    private extractWallpaperTint;
    /** Draw a wallpaper image into the extractor. */
    private extractImageHue;
    /** Draw the wallpaper video's first available frame into the extractor. */
    private extractVideoHue;
    /** Apply the mode's token layer (floating palette, or translucent compat). */
    private applyTokens;
    /** The text-ink override for the current preset: redefines the warm ink
     *  tokens only; every other token falls through to the base layer. */
    private inkOverrides;
    private mount;
    /** Performance / balanced keep the last fluid frame; vivid runs the loop. */
    private allowFluidLoop;
    /** Balanced + vivid keep stars / drift / dispersion / specular. */
    private allowMotionFx;
    /** Only vivid mounts the optional extras (whale / mesh / audio). */
    private allowDecor;
    /** Hover glow / tilt stay off in the performance gate. */
    private allowHoverFx;
    /** Mount or drop motion layers to match the performance gate. */
    private syncMotionLayers;
    /** Mount the Mineradio star-river particle stage when the gate allows it. */
    private syncStarRiver;
    /** Start or stop the cinematic camera drift. */
    private syncCinemaDrift;
    /** Start or stop the glass chromatic-dispersion filter. */
    private syncGlassDispersion;
    /** Start or stop the specular-highlight cursor parallax. */
    private syncSpecularParallax;
    /** Mount or drop the particle whale to match enabled + the whale flag. */
    private syncWhale;
    /** Mount or drop the interactive mesh to match enabled + the mesh flag. */
    private syncMesh;
    /** Start or stop the mic audio feed to match enabled + the audioReact flag.
     *  The feed routes bass → fluid, mids/highs → star river, and overall
     *  loudness → a CSS var that lifts the spotlight glow. */
    private syncAudioReact;
    private unmount;
    /** Attach the fluid shader and the interaction feeds. */
    private mountFluid;
    private teardownFluid;
    private fluidParams;
    /** Slow hue walk for the rainbow scene. Does not rewrite the stored knob. */
    private syncRainbowDrift;
    private stopRainbowDrift;
    private applyFluidPalettes;
    /** Stamp the data-* seams the stylesheet keys off (self-contained mode). */
    private startSeamStamper;
    /** Attach the cursor-spotlight pointer feeds (idempotent per mount). */
    private startSpotlightFeed;
}
export {};
