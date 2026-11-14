# Agent Note: Dense plate for diff-preview HoverCards

Status: implemented

## Problem

The turn's "edited files" hover preview is a HoverCard `variant="preview"` portaled onto `body`. The theme dressed body-child `_card` elements with the translucent family card material, and the preview's inner diff lines also paint translucent fills. Stacked together the popup let conversation text and the fluid show through, making the preview unreadable against the page — unlike other popups (menus, inline media previews) which use the dense menu material.

## Decision

Keep the shared family rule for row HoverCards, and add a targeted rule for cards containing `[data-changes-hover-preview]`: use the dense menu plate (`--dsw-specific-menu`, ~0.92 alpha) with the family blur, and back the inner preview surface with `--dsw-alias-bg-layer-1` plus a half-strength blur. The diff ink keeps its own colors, so the popup reads as one readable glass card instead of a translucent sticker.

## Alternatives considered

- Make every body-child HoverCard dense: simplest, but the compact 244px row previews look best with the lighter family material and only the diff preview demonstrably failed.
- Remove translucency from the inner preview only: leaves the card plate itself translucent over busy content; the double-stack is what fails.
- Fix in the host (dsh-source): the host already ships an opaque default; the overlap is caused by this theme's override interacting with translucent diff fills, so the theme owns the fix.

## Verification

`node tests/hovercard-preview-glass.mjs` builds the shipped CSS from `lib/client.js`, renders a HoverCard preview card over a busy gradient page in dark mode, and asserts the card resolves the dense menu plate with an active family blur. `--baseline` strips the new rules and records the old translucent measurement; it passes as a recording run, while the fixed run asserts `cardAlpha >= 0.75` and active blur. Eight consecutive fixed runs pass; the shipped-CSS regression suite (#9/#10, terminal glass, station, glow geometry) passes after the change. Six-run sampling showed an unrelated pre-existing Chrome-launch race in `sidebar-terminal-glass.mjs` (~1 in 4), which passes on retry and is not caused by this rule.

## Consequences

Diff previews gain a readable dense plate while row previews keep the lighter material. If the host later renames the `data-changes-hover-preview` seam, the targeted rule stops matching and the card falls back to the shared family material — the shared rule still applies, so the regression would be legibility-only, not layout. The test depends on extracting injected CSS from the shipped bundle, consistent with the other shipped-CSS gates.
