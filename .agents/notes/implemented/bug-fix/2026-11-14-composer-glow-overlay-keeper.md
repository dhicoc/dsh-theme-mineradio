# Agent Note: Anchor boxless Composer glow and batch overlay discovery

Status: implemented

## Problem

Issue #11 occurs when the stamped inputbar has `display: contents`. Its glow is absolutely positioned by a boxed ancestor, while the old offset walk searches for the inputbar in the offset-parent chain. That ancestor is absent from the chain, so the walk returns page-level offsets and applies them again inside the Composer seat. Chromium reproduces a long conversation growing from scrollHeight 2806 to 5420 on hover, with glow.top 3053 against glass.top 399.

The overlay keeper also scans every stamped pane for each child-list MutationObserver delivery. Text streaming and the keeper's own overlay attachments amplify this work. In the baseline, 200 text replacements separated by microtasks produce 200 full-document scans and 200 callbacks; adding 80 panes causes a second full scan from the keeper's own writes.

## Decision

Keep the overlay attached to its logical spot so existing descendant selectors and hover ownership remain valid. Measure overlay placement against its actual `offsetParent` padding box, including each offset parent's border and scrolling ancestors that are absent from the offset chain. A null offset parent denotes the initial containing block. Layout coordinates remain independent of common ancestor transforms and the spot's own tilt. The pointer gradient converts viewport distances back to local distances for common ancestor scaling. New and cleared overlays have zero dimensions, and clearing also resets their origin, so inactive geometry cannot remain after content shrinks.

The keeper performs one bootstrap discovery, observes added subtrees and the two spot marker attributes, and coalesces changes in requestAnimationFrame. It deduplicates nested added roots, repairs only affected owners, skips its overlay attachments, handles marker removal, and prunes disconnected tracked owners only after element removals. Plain text replacements trigger one layout callback per frame without scanning element subtrees or tracked owners. The spotlight callback checks only the current sidebar, and a capture-phase scroll listener refreshes the active geometry even when scrolling produces no DOM mutation.

## Alternatives considered

- Reparent each glow onto a boxed ancestor. This would make the positioning reference explicit, but breaks logical owner descendant selectors and complicates nested spot ownership. Reading the actual offset parent preserves the existing DOM/CSS contract.
- Use viewport rectangle subtraction for every local coordinate. It directly handles axis-aligned screen positions, but applying already-transformed distances inside a scaled or tilted pane applies transforms twice. Offset geometry retains untransformed lengths; viewport rectangles continue to serve pointer hit testing.
- Keep global discovery but debounce it once per frame. This removes repeated work within a frame, but still walks all spots throughout long streaming conversations. Incremental roots avoid that scan altogether after bootstrap.

## Consequences

The Composer retains its expected scroll extent and visible glow alignment. Existing Composer/chat/sidebar/question tilt exclusions remain intact. Overlay discovery can lag a mutation by one animation frame; geometry refresh is separately coalesced. The controller retains a set of known owners and transient added roots until the next frame or disposal. CSS transforms on an independently transformed descendant between the containing block and glass require separate matrix handling; the current contract covers shared ancestor transforms and owner transforms, which are the paths exercised here.

The new test bundles the two TypeScript modules in memory with esbuild `write:false`, launches real Chromium via CDP, and writes measurements under the repository's outputs/issue-11-composer-glow directory. It does not build or validate shipped lib artifacts. The fixture models the reported stable data attributes, boxless wrapper and positioned Composer seat, rather than mounting the complete DSH application. Desktop/full application acceptance remains an integration check for the lead.

## Verification

Run `node tests/issue-11-composer-glow.mjs`. Fourteen geometry checks cover stats present/absent, scales 1/.8/1.15 and translation, scroll and resize during hover, React-style card replacement and glow repair, bordered scrollers, an intermediate scroller absent from the offset-parent chain, owner 3D transform, and the initial containing block. Every check asserts scrollHeight/scrollTop preservation and overlay/glass four-edge agreement within 1.1 CSS pixels. The reference stats-present case stays at scrollHeight 2806 and scrollTop 2296; glow and glass share left=101, top=399, right=758, bottom=525.

The same run checks 200 text mutations produce zero global/subtree scans and one callback; an 80-pane batch produces zero global scans, one subtree scan and one callback. Overlay repair, marker removal/readdition and disposal have separate assertions. `node tests/issue-11-composer-glow.mjs --baseline` loads the exact old sources from commit `13f1b892e4e557bb1459d8afbfd0ba67e76ec221` and exits 1 at 5420 !== 2806. `--baseline --keeper-only` fails the global-scan assertion; adding `--report-only` records old counts without assertions. `ISSUE_11_BASELINE_REF` selects a different explicit source reference when required. The existing reopened #9/#10 regression passes with the changed spotlight source.

## Historical note audit

The [reopened #9/#10 note](2026-10-13-reopened-issues-9-10.md) partially overlaps through spotlight tilt exclusions; those decisions remain intact and this note covers coordinate ownership and discovery scheduling. The fullscreen isolation and terminal family-glass notes concern separate CSS paint ownership, so they remain independent. The custom-text-color note only shares Composer selectors and concerns a separate feature. No existing decision is replaced.
