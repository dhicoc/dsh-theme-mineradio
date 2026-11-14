# Agent Note: Give the built-in rightbar terminal a dedicated family-glass screen

Status: implemented

## Problem

The right sidebar can create a built-in xterm 6 terminal, but its body renders as a solid black rectangle while file/browser panes show the Mineradio backdrop. Desktop inspection shows the current stable root is `data-sidebar-terminal`; legacy rules target `data-dsh-panel-host` and `terminalWrap`, so they do not establish a glass owner. The viewport and screen are already transparent, but xterm 6 writes the effective black theme background inline on `.xterm-scrollable-element`, which the old selectors omit.

## Decision

Use the built-in terminal's stable `data-sidebar-terminal` root and make its direct CSS-module `screen` child the family-glass owner. Give that screen the terminal block radius, light/dark family border, card background, shadow and backdrop blur, with small rightbar insets. In performance mode retain the material and remove blur.

Match xterm's scrollable element, viewport and screen through exact class-token attribute selectors so the CSS-module builder does not hash third-party class names, then override their backing colors to transparent with important priority because the scrollable element's color is inline. Do not apply backdrop-filter to `.xterm`, rows, cursor, selection or helper textarea: terminal ink remains sharp and xterm retains responsibility for glyphs, cursor and selections. Keep legacy panel-host selectors for older third-party terminals.

## Alternatives considered

- Dress every xterm descendant with generic family glass: visually strong but blurs text layers and creates nested filters and containing blocks.
- Only clear `.xterm-scrollable-element`: removes black but leaves the terminal as raw wallpaper rather than an intentional family surface.
- Change the host terminal constructor to `allowTransparency`: semantically clean inside DSH, but this theme must work without patching the host package and current Desktop ships `allowTransparency: false`.

## Consequences

- Built-in rightbar terminals match the family material in push and fullscreen layouts, float and compatibility modes, and light/dark appearance.
- OSC/application terminal background overrides are visually made transparent by the theme while Mineradio is enabled; ANSI foreground/background cells, selection and cursor rendering remain xterm-owned. Disabling the theme restores the stock inline terminal background.
- The selector relies on the stable terminal data attribute plus the existing CSS-module `screen` word root; no observer, runtime mutation or host patch is added.

## Verification

A shipped-bundle browser fixture reproduces the xterm 6 inline black background and checks float/compat, light/dark and push/fullscreen combinations. It verifies the screen owns glass, all three xterm backing layers become transparent, text layers have no backdrop-filter, performance disables blur, and theme disable restores stock black. A negative control removes the terminal rules and must fail. Desktop acceptance uses the actual new-terminal flow and records computed styles and screenshots after reloading the linked build.


The first browser run kept scrollable black and viewport at the stock base even though the raw Desktop preview worked. The cause was the theme's custom CSS-module builder: literal `.xterm-*` selectors inside this module are renamed. Stable third-party class tokens therefore use `[class~='xterm-*']`, which the builder preserves. The failing assertions stayed in place and identified both unthemed layers.

The second run exposed a separate build-tool boundary: `minifyCss()` removes whitespace before `:`, so a descendant ` [data-sidebar-terminal] :is(...)` is emitted as the same-element selector `[data-sidebar-terminal]:is(...)`. The production selector now uses an explicit comma list with no descendant pseudo-class boundary. The test continues to consume built `lib/client.js`, so source-only correctness cannot hide this transform.

Measured result: the built-bundle test passes 8 float/compat, light/dark and push/fullscreen combinations plus performance and theme-disable paths. Removing all current-terminal selectors fails on the missing screen margin/radius, proving the gate detects the old implementation. The complete runtime pipeline passes 33/33 gates. Typecheck and 9 store-adapter tests remain green. Desktop reproduction confirmed the old inline black `.xterm-scrollable-element`; a live preview on the actual terminal confirmed the family material and crisp text before the production rule was built. Final built behavior is covered by the shipped-bundle fixture; foreground computer use was stopped when user input took focus.
