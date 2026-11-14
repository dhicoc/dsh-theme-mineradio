# Agent Note: Keep station tuning off transcript mutation paths

Status: implemented

## Problem

Issue #12 reports session creation stalls while multiple document-wide observers react to the same DOM updates. The station dial is another such observer: every child-list record rescans all sidebar treeitems, including message streaming and the frequency label's own updates. It also misses attribute-only selection changes because it only observes child lists.

## Decision

The dial schedules one scan per animation frame only for mutations within a sidebar treeitem or additions/removals containing treeitems or the wordmark. It observes aria-selected, class and characterData so selection changes and workspace renames retain their behavior. Frequency-label mutations are ignored, unchanged tuning attributes are left alone, and a scan preserves the active glide indicator. Disposal cancels the pending scan before removing the label.

The companion [census and seam repair](2026-11-14-incremental-census-seams.md) handles material classification separately. The dial retains its station identity, stored hue and animation behavior.

## Alternatives considered

- Coalesce every document mutation into a frame: reduces frequency but still rescans the sidebar on every streaming frame. Relevant-subtree filtering removes that work entirely.
- Observe only a cached sidebar element: has a smaller observation target but loses replacements of the sidebar and the late-mounted wordmark. The document observer retains discovery while filtering records before scanning.

## Consequences

The Chromium regression inserts 100 chat nodes across separate mutation deliveries. The old implementation performs 101 station scans versus the initial single scan in the repaired version. The test also verifies an attribute-only selection change, in-place workspace rename and cancellation during teardown. It fails against the old source and passes against the repaired source. These measurements establish removal of redundant work; they do not substitute for the reporter's native WebView timing.
