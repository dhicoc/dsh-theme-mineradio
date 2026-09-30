/**
 * Token layer — the primary coverage mechanism for Mineradio 3.0.
 *
 * WHY THIS REPLACES THE OLD APPROACH
 * The 2.x theme dressed surfaces with selectors. That loses to the host for a
 * structural reason: component CSS Modules and the shell's own rules compete on
 * specificity, and the shell does paint opaque fills on `.tabHost`, `.centerCol`
 * and the conversation column. Measured: a `(0,2,0)` word-root sweep does not
 * clear `._tabHost_… { background: var(--dsw-alias-bg-base) }`.
 *
 * The host ships a better seam. `ctx.theme.overrideTokens(source, tokens)`
 * (packages/client/ui-theme/src/client/index.ts:309) writes the active theme's
 * alias tokens as INLINE CSS variables on `document.body`
 * (packages/client/ui-layout/src/client/theme-presenter.ts:64-67). Inline custom
 * properties beat any component rule on the same element without `!important`
 * and without a specificity contest, and they cascade to every descendant that
 * consumes them — including into `::before` / `::after`, which inherit custom
 * properties from their originating element.
 *
 * Measured scope (outputs/rc2-source/coverage-strategy.md): 97.3% of painted
 * backgrounds (581/597) resolve to a `--dsw-*` token, so overriding tokens
 * reaches almost every surface at once. The high-value handful —
 * `--dsw-alias-bg-base` (42 consuming backgrounds), `bg-layer-1` (48),
 * `bg-module-platform` (28), `bg-layer-2` (21), `bg-layer-3` (12) — IS the
 * opaque page ground the user kept seeing.
 *
 * CONTRACT NOTES THAT MATTER
 * - `{ light, dark }` pairs are mandatory; a bare string throws a TypeError at
 *   runtime (`validateOverrides`, index.ts:384-404). Every entry here supplies
 *   both, even when the value is identical.
 * - Layers are shallow-merged per token, later registration wins
 *   (`composeActive`, index.ts:344-353), so this layer must be applied after the
 *   user's own theme choice, and disposed to restore it.
 * - `register()` is NOT the seam for a skin: a third-party theme id is never
 *   written back to host settings (index.ts:238), so it reverts on restart.
 */

/** Light and dark values for one token. Mirrors the host's ThemeTokenModes. */
export interface TokenModes {
  light: string
  dark: string
}

/**
 * The token overrides Mineradio applies.
 *
 * Every value is a translucent or gradient expression so the ambient scene and
 * the wallpaper stay visible through the UI. Nothing here is opaque: an opaque
 * alias token is exactly what produced the "ink fill" the user reported.
 *
 * `--dsh-aqua-frost` is the existing user-facing knob that scales how much glass
 * each surface wears, so the token layer honours it too.
 */
export function buildTokenOverrides(): Record<string, TokenModes> {
  /** Frost multiplier: 0 = fully transparent, 1 = the default mix. */
  const m = (percent: number) => `calc(${percent}% * var(--dsh-aqua-frost, 1))`

  return {
    // --- the page ground: the single highest-value override ---------------
    // Consumed by 42 backgrounds, and the only source of the whole-page base
    // (`design-platform.css:281`). Opaque here is what hid the fluid entirely.
    '--dsw-alias-bg-base': {
      light: `color-mix(in srgb, #F7F3EA ${m(72)}, transparent)`,
      dark: `color-mix(in srgb, rgb(21 21 23) ${m(72)}, transparent)`,
    },

    // --- layer fills: 48 + 21 + 12 consuming backgrounds ------------------
    '--dsw-alias-bg-layer-1': {
      light: `color-mix(in srgb, #FFFFFF ${m(58)}, transparent)`,
      dark: `color-mix(in srgb, rgb(14 16 20) ${m(58)}, transparent)`,
    },
    '--dsw-alias-bg-layer-2': {
      light: `color-mix(in srgb, #F0EAE0 ${m(56)}, transparent)`,
      dark: `color-mix(in srgb, rgb(21 23 28) ${m(56)}, transparent)`,
    },
    '--dsw-alias-bg-layer-3': {
      light: `color-mix(in srgb, #E9E2D6 ${m(52)}, transparent)`,
      dark: `color-mix(in srgb, rgb(28 31 37) ${m(52)}, transparent)`,
    },

    // --- panels and menus: 28 + overlays ----------------------------------
    '--dsw-alias-bg-module-platform': {
      light: `color-mix(in srgb, #FFFFFF ${m(58)}, transparent)`,
      dark: `color-mix(in srgb, rgb(14 16 20) ${m(58)}, transparent)`,
    },
    '--dsw-alias-bg-multi-select': {
      light: `color-mix(in srgb, #FFFFFF ${m(58)}, transparent)`,
      dark: `color-mix(in srgb, rgb(21 23 28) ${m(58)}, transparent)`,
    },
    '--dsw-alias-bg-overlay': {
      // Overlays need more body than a panel: text sits directly on them.
      light: `color-mix(in srgb, #E3DBCB ${m(82)}, transparent)`,
      dark: `color-mix(in srgb, rgb(35 38 45) ${m(84)}, transparent)`,
    },

    // --- chrome ------------------------------------------------------------
    '--dsw-specific-sidebar-fill': {
      light: `color-mix(in srgb, #FFFFFF ${m(60)}, transparent)`,
      dark: `color-mix(in srgb, rgb(15 17 21) ${m(62)}, transparent)`,
    },
    '--dsw-specific-input-major': {
      light: `color-mix(in srgb, #FFFFFF ${m(58)}, transparent)`,
      dark: `color-mix(in srgb, rgb(26 29 34) ${m(60)}, transparent)`,
    },

    // --- settings card: shipped in base.css:25 and derived from layer-2,
    //     listed explicitly so the value is visible to readers of this file.
    '--dsw-alias-settings-card-fill': {
      light: `color-mix(in srgb, #F0EAE0 ${m(56)}, transparent)`,
      dark: `color-mix(in srgb, rgb(21 23 28) ${m(56)}, transparent)`,
    },

    // --- document preview keeps a readable body but stops being pure white --
    '--dsw-alias-bg-document-preview': {
      light: `color-mix(in srgb, #FFFFFF ${m(88)}, transparent)`,
      dark: `color-mix(in srgb, rgb(21 21 23) ${m(88)}, transparent)`,
    },

    // --- code blocks stay legible: a strong body, still faintly translucent
    '--dsw-alias-markdown-code-block': {
      light: `color-mix(in srgb, #F5F1E8 ${m(94)}, transparent)`,
      dark: `color-mix(in srgb, rgb(27 27 28) ${m(94)}, transparent)`,
    },

    // --- blur knob already consumed by 13 of the 18 backdrop declarations --
    '--dsw-menu-backdrop-filter': {
      light: 'blur(22px) saturate(1.22) brightness(1.04)',
      dark: 'blur(22px) saturate(1.22) brightness(1.04)',
    },
  }
}

/**
 * Registry of the tokens this layer is expected to cover, with the reason each
 * one matters. Kept next to the values so a reader can see the intent, and so a
 * test can assert the layer covers the tokens that were measured to matter.
 */
export const COVERED_TOKENS: ReadonlyArray<{ token: string; consumes: number; why: string }> = [
  { token: '--dsw-alias-bg-base', consumes: 42, why: 'the whole-page ground; opaque here hid the fluid' },
  { token: '--dsw-alias-bg-layer-1', consumes: 48, why: 'most-consumed panel fill' },
  { token: '--dsw-alias-bg-layer-2', consumes: 21, why: 'secondary panel fill' },
  { token: '--dsw-alias-bg-layer-3', consumes: 12, why: 'tertiary panel fill' },
  { token: '--dsw-alias-bg-module-platform', consumes: 28, why: 'platform module surfaces' },
  { token: '--dsw-alias-bg-overlay', consumes: 0, why: 'menus and dialogs need a readable body' },
  { token: '--dsw-specific-sidebar-fill', consumes: 10, why: 'sidebar chrome' },
  { token: '--dsw-specific-input-major', consumes: 10, why: 'composer and inputs' },
  { token: '--dsw-alias-markdown-code-block', consumes: 16, why: 'code legibility carve-out' },
  { token: '--dsw-alias-bg-document-preview', consumes: 2, why: 'document preview body' },
  { token: '--dsw-alias-settings-card-fill', consumes: 5, why: 'settings cards' },
  { token: '--dsw-menu-backdrop-filter', consumes: 13, why: 'the host blur knob, reused as ours' },
]
