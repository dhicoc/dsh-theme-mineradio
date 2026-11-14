# Agent Note: Isolate the mounted conversation behind a transparent fullscreen rightbar

Status: implemented

## Problem

Desktop reproduction in the existing session shows file-tree/code content superimposed on the conversation header, messages and composer. The AppFrame retains its centre Grid track in fullscreen. Stock DockKit covers it with an opaque base; Mineradio's L0/L0b sweep deliberately removes that base. In the live 1280px viewport the centre occupies x=280..680, while the transparent fullscreen rightbar occupies x=280..1280. Both remain visible. Role-census glass classification alone cannot establish visual isolation.

## Decision

Gate a CSS paint/input suppression rule on the enabled theme, the frame's fullscreen state and an open fullscreen panel outside any hidden session. Set the frame's direct centre column to visibility:hidden, opacity:0 and pointer-events:none. Opacity suppresses children that explicitly restore visibility. Preserve the Grid track and mounted React tree; removing the open/fullscreen/theme condition restores stock visibility without an observer or persistent inline mutation.

The absolute panel itself gets no backdrop-filter, transform, clipping or stacking context. Instead, each currently active DockKit content pane owns the family material only while the rightbar has `data-sidebar-right-open`. Closing removes its filter synchronously; reopening in push or fullscreen restores it without waiting for census. Independently floating DockKit panes remain outside that filtered content pane and keep viewport geometry. Both float and compatibility modes share this state contract.

## Alternatives considered

- Restore an opaque fullscreen pane: the stock solution is simple, but removes the requested transparent ambient theme from fullscreen content and makes frost=0 behave differently.
- Set display:none on the centre: removes text, but changes Grid auto-placement and track geometry; it can shift the rightbar rather than preserve the host layout contract.
- Keep the existing glass-role-only check: avoids changes but does not test whether conversation pixels or input remain underneath the transparent pane; the new test fails on the existing shipped bundle.

## Consequences

- Open push/fullscreen panes retain family frost without conversation bleed-through; collapse removes the material and overlay immediately, while reopen/exit restores the appropriate state and preserves the same conversation, scroll position and draft.
- Hidden retained sessions cannot activate suppression. The selector depends on stable host data attributes and the CSS-module centre class root already used by the theme.
- CSS suppression keeps the session mounted rather than stopping its background computation. Hidden centre content is intentionally unavailable during fullscreen.

## Verification

The added harness uses real AppFrame/SidebarRight/DockKit styles and CSS extracted from lib/client.js, not an assumed glass role. It checks rendering visibility, click hit-testing, retained Grid geometry, draft retention, collapsed/reopened/exited states, hidden sessions, theme disabling, light/dark schemes, float/compat modes and three viewport widths. Removing the new rule must fail. Desktop UI verification checks the existing session and actual fullscreen controls after reloading the linked built theme. Results are recorded after execution in the task log.


Measured results on 2026-10-13: 96 viewport/mode/scheme/state combinations pass against CSS extracted from `lib/client.js`; removing conversation isolation or open-pane glass fails independently. Actual Desktop reproduces the old transparent push pane, then verifies push glass, fullscreen glass, fullscreen-collapse without residue, and fullscreen reopen with immediate frost. Typecheck, store-adapter tests, terminal glass tests and the reopened #9/#10 acceptance gate are green.
