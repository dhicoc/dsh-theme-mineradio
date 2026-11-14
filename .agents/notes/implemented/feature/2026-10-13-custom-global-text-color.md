# Agent Note: Custom global text color with dual-scheme lightness ladder

Status: implemented

## Problem

Mineradio Theme previously restricted global text ink customization (`TextStyle`) to four fixed presets (`champagne`, `neutral`, `mint`, `rose`). Users could not specify an arbitrary hex color for global typography, and several surfaces in `mineradio.module.css` (such as `[data-dsh-stats]` and composer `textarea::placeholder`) hardcoded RGB colors instead of referencing `--dsw-alias-label-*` tokens. Directly applying a single raw hex color to `--dsw-alias-label-primary` across both light and dark modes breaks WCAG AA legibility when the user switches appearance schemes or selects a color whose luminance matches the active glass background.

## Decision

Extend `TextStyle` to `'champagne' | 'neutral' | 'mint' | 'rose' | 'custom'` and persist `customTextColor` under `dsh.ui-mineradio.customTextColor` (default `#F2F0EA`).

1. **HSL Lightness Ladder Derivation**: When `textStyle === 'custom'`, `textInkPalette()` parses the user-supplied hex color into HSL `(h, s, l)` and derives a full 7-token `TextInkPalette` (`primary`, `secondary`, `tertiary`, `caption`, `dimmed`, `bluish`, `primaryDimmed`) for both `light` and `dark` schemes. If the chosen color has `l >= 0.48`, dark mode uses the exact hex for `primary` while light mode adapts `primary` to `l = 0.16` at the same hue/saturation; conversely, if `l <= 0.52`, light mode uses the exact hex for `primary` while dark mode adapts `primary` to `l = 0.90`.
2. **Token Coverage**: Replace hardcoded RGB text and placeholder colors on `[data-dsh-stats]` and `[data-composer-card] textarea::placeholder` in `mineradio.module.css` with `var(--dsw-alias-label-secondary)` and `var(--dsw-alias-label-caption)`.
3. **Settings UI**: Add a `'custom'` segment to the text color control in `MineradioAppearanceRow.tsx` that reveals a synchronized `<input type="color">` swatch and a `#RRGGBB` text input.

## Alternatives considered

- **Apply raw hex directly to all label tokens without lightness adaptation**: Rejected because secondary/tertiary hierarchy collapses into flat monochrome and switching between light and dark appearance modes makes text unreadable against translucent glass surfaces.
- **Require separate light and dark custom color pickers**: Rejected because it doubles settings UI complexity for the common case where a user wants a single signature text tint.
- **Expand only discrete presets**: Rejected because fixed presets cannot cover arbitrary user brand/wallpaper palettes.

## Consequences

- Users can pick any hex color via native color picker or hex input while preserving visual hierarchy across primary, secondary, tertiary, caption, and dimmed labels.
- Both light and dark themes maintain readable contrast over frosted glass, passing all 31 verification gates including WCAG AA `text-contrast-test.mjs`.
- Existing scene presets (`studio`, `deepsea`, `midnight`, `mist`, `rainbow`) continue to set their respective preset `textStyle` without overwriting the stored `customTextColor`.
