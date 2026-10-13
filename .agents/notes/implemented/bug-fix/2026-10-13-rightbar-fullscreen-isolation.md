# Agent Note: Isolate the mounted conversation behind a transparent fullscreen rightbar

Status: implemented

## Problem

Desktop reproduction in the existing session shows file-tree/code content superimposed on the conversation header, messages and composer. The AppFrame retains its centre Grid track in fullscreen. Stock DockKit covers it with an opaque base; Mineradio's L0/L0b sweep deliberately removes that base. In the live 1280px viewport the centre occupies x=280..680, while the transparent fullscreen rightbar occupies x=280..1280. Both remain visible. Role-census glass classification alone cannot establish visual isolation.

## Decision

Gate a CSS paint/input suppression rule on the enabled theme, the frame's fullscreen state and an open fullscreen panel outside any hidden session. Set the frame's direct centre column to visibility:hidden, opacity:0 and pointer-events:none. Opacity suppresses children that explicitly restore visibility. Preserve the Grid track and mounted React tree; removing the open/fullscreen/theme condition restores stock visibility without an observer or persistent inline mutation.

The panel itself gets no new backdrop-filter, transform, clipping or stacking context. Independently floating DockKit panes and the sidebar retain their existing behaviour. Both float and compatibility modes need isolation because both share the translucent token/shell layer.

## Alternatives considered

- Restore an opaque fullscreen pane: the stock solution is simple, but removes the requested transparent ambient theme from fullscreen content and makes frost=0 behave differently.
- Set display:none on the centre: removes text, but changes Grid auto-placement and track geometry; it can shift the rightbar rather than preserve the host layout contract.
- Keep the existing glass-role-only check: avoids changes but does not test whether conversation pixels or input remain underneath the transparent pane; the new test fails on the existing shipped bundle.

## Consequences

- Fullscreen rightbar retains transparent ambient visuals without conversation bleed-through; collapse/exit restores the same conversation, scroll position and draft.
- Hidden retained sessions cannot activate suppression. The selector depends on stable host data attributes and the CSS-module centre class root already used by the theme.
- CSS suppression keeps the session mounted rather than stopping its background computation. Hidden centre content is intentionally unavailable during fullscreen.

## Verification

The added harness uses real AppFrame/SidebarRight/DockKit styles and CSS extracted from lib/client.js, not an assumed glass role. It checks rendering visibility, click hit-testing, retained Grid geometry, draft retention, collapsed/reopened/exited states, hidden sessions, theme disabling, light/dark schemes, float/compat modes and three viewport widths. Removing the new rule must fail. Desktop UI verification checks the existing session and actual fullscreen controls after reloading the linked built theme. Results are recorded after execution in the task log.


Measured results on 2026-10-13: 96 harness combinations pass; removing isolation fails with centre visibility `visible` instead of `hidden`; all 32 runtime gates pass; note validation passes. Actual Desktop loads the built selector and reports centre hidden/opacity zero, header/composer invisible, unchanged centre geometry. Opening curated138.json in fullscreen and exiting to split view are visually verified. Existing TypeScript errors remain outside this CSS fix; typecheck is not green.
