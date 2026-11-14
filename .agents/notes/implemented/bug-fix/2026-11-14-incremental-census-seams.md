# Agent Note: Incremental role census and seam stamping for issue #12

Status: implemented

## Problem

Issue #12 reports slow session creation. Attribute changes in the old census schedule a delayed full-root enumeration, while the seam stamper runs its document-wide selectors for every child-list mutation, including text streaming. The census clears and re-stamps each face between geometry reads, repeatedly invalidating layout. The old delayed sweep memoizes classification: the demonstrated cost is DOM enumeration, not remeasuring every element on every attribute change.

## Decision

Attribute changes invalidate the affected subtree. Pending roots coalesce so an ancestor absorbs descendants from the same commit. Descendants remain in scope because ancestor class, visibility and state can change inherited paint and geometry. Initial discovery, explicit rescan and viewport resize retain a whole-root pass.

Each animation-frame transaction clears its batch's owned stamps, reads every decision, then commits every result. This reveals actual host paint without interleaving writes between geometry reads. Batch size starts at 32, caps at 64, and adapts to the existing 6 ms policy. Every transaction restores its batch before yielding. Owned-role accounting releases detached nodes and reclassifies reinserted nodes. Classification thresholds, rightbar exceptions, positional anchors, own-layer/readability exclusions and pseudo-element ownership remain unchanged.

Seam discovery follows added or selector-changed subtrees and their parents, once per frame. Declaration order preserves dependent inputbar/trajectory/surface-to-spot seams. Cached first matches compare local candidates in document order; removal or selector invalidation triggers lookup only for that seam. Existing additive stamps remain in place. Text-only child-list changes skip discovery. A composer-local query updates the on-air lamp only when affected and only writes changed values. Observed selector attributes exclude generated outputs. Disposal cancels queued work and releases references.

The companion [station scope decision](2026-11-14-station-mutation-scope.md) handles sidebar tuning separately; the [glow keeper decision](2026-11-14-composer-glow-overlay-keeper.md) handles overlay discovery and geometry.

## Alternatives considered

- Debounce a whole-document sweep: simple and compatible with existing selectors, but still enumerates unrelated DOM throughout streaming. Dirty subtrees preserve discovery without recurring root work.
- Process only the changed element: cheap, but misses inherited visibility/paint changes in descendants. The affected subtree is the required scope.
- Read host paint while leaving census stamps applied: avoids clearing writes, but classifies the theme's own material instead of the host background. A batch reset/read/commit transaction preserves correct ownership.
- Remove every historical seam that stops matching: cleaner ownership in isolation, but changes existing additive semantics and is outside this performance repair.

## Verification

`node tests/issue-12-census-seams.mjs` runs the source modules in real Chromium with focused material styles. Fixtures and profiles live in repository outputs/issue-12-census-seams/run-* directories. CDP waits for the helper's readiness before assertions. The immutable negative-control commit is 13f1b892e4e557bb1459d8afbfd0ba67e76ec221, so merges cannot silently update the baseline.

| Probe | Original | Repaired |
| --- | ---: | ---: |
| Root enumeration 380 ms after local attribute change | 1 | 0 |
| Global seam queries after 12 appended text nodes | 16 | 0 |
| Initial frames with writes between geometry reads | 4–5 | 0 |
| Geometry reads for 100 same-frame changes to one face | — | 1 |
| Geometry reads from spotlight style output | — | 0 |

The `--baseline` mode verifies the old causes. Independent `--original-role-census` and `--original-seam-stamper` controls fail their respective assertions. Behavior coverage includes ordinary/rightbar/question paint, pseudo-element veils, readability/anchor/own-layer exclusions, ancestor hiding and transparent paint, detach/reinsert, stop-button transitions, late composer/trajectory seams, first-header replacement, rescan and disposal.

## Consequences

Local mutations avoid periodic global enumeration and geometry reads share a transaction. Meaningful ancestor changes can still traverse a large affected subtree, and discovery precedes the adaptive timing budget. A slow individual transaction can exceed 6 ms. Changes become visible after at most the scheduled frame under ordinary foreground rendering.

Counters establish reduced queries and improved read/write ordering; they do not establish native WebView session latency, GPU cost or FPS. The standalone fixture does not mount the complete application. Integration separately builds the shipped bundle and runs the repository's CSS and geometry regression suites.
