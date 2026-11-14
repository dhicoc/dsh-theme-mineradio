# Agent Note: Incremental role census and seam stamping for issue #12

Status: implemented; source-level browser verification complete, integration build and deployed verification delegated to lead.

## Ownership and preserved work

This work changes only `src/client/role-census.ts`, `src/client/seam-stamper.ts`, `tests/issue-12-census-seams.mjs` and this note. The shared checkout already contained extensive user changes. No build, lib output, package manifest edit, commit, push, host installation or station/spot/theme-layer edit was performed by this agent.

Loaded investigation, performance-optimization and dsh-doc guidance. The direct task constrains the work to source fixes and independent tests; integration and deployment remain with lead.

## Reproduced causes before the fix

The independent Chrome/CDP test transpiles the two TypeScript modules in memory using the installed TypeScript package. It loads the modules directly in a unique `outputs/issue-12-census-seams/run-*` fixture/profile, with real layout/computed style and instrumentation of root enumeration, document selectors, geometry reads and census stamp mutations. It does not build the plugin. CDP connection is followed by a bounded wait for `typeof settle === 'function'` before performance assertions, so a page still loading cannot masquerade as a negative-control failure.

`node tests/issue-12-census-seams.mjs --baseline` loads both modules from the immutable original-source commit `13f1b892e4e557bb1459d8afbfd0ba67e76ec221` using `git show <commit>:<file>`, so later commits and merges do not change the negative-control baseline. It verifies the original symptoms:

| Probe | Original source | Fixed source |
| --- | ---: | ---: |
| Full `#root.querySelectorAll('*')` 380 ms after one local `data-state` change | 1 | 0 |
| Document seam queries after one batch of 12 text-node appends | 16 | 0 |
| Initial census frames with writes between the first and last geometry read | 4–5 in recorded runs | 0 |
| Geometry reads after the single local attribute change | 1 | 1 |
| Geometry reads for 100 same-frame attribute changes of one face | not a baseline claim | 1 |
| Geometry reads after spotlight inline style output | not a baseline claim | 0 |

The original delayed census sweep memoized classification, so the observed defect is full DOM enumeration, not necessarily remeasuring every element on every attribute change. The original census also clears and re-stamps a role around each element's geometry read, invalidating style/layout between elements. The original seam observer always invokes all document selectors even for text-only childList changes.

## Decisions

### Role census

- Attribute changes mark their own subtree dirty instead of scheduling a 300 ms whole-root sweep. Dirty roots are coalesced, so a dirty ancestor subsumes dirty descendants from the same commit. Descendants are invalidated because ancestor class, visibility and state can change inherited paint or descendant geometry. Rightbar mode/open transitions use the same targeted path.
- Initial census, explicit `rescan()` and viewport resize retain whole-root discovery. Mutation work stays within the affected subtree.
- Each animation-frame transaction first removes the batch's census-owned attributes, then reads/classifies every candidate, then writes every result. Removing census paint is necessary to inspect the host's actual background and distinguish transparent host faces from theme glass or a pre-existing family rim.
- Start at 32 candidates and cap at 64; size the next transaction against the existing 6 ms policy using observed transaction duration. Complete each reset/read/commit transaction synchronously so no partially reset batch reaches a paint.
- Track current owned roles explicitly to maintain role/stamped counts during reclassification and detached-subtree cleanup. Reinserted or reparented elements invalidate the old memo and receive a fresh decision.
- Preserve role classification thresholds, rightbar viewport-sized glass exception, fixed-anchor exclusions, own-layer exclusions, readability carve-outs, pseudo-element veil carriers and the in-flow spotlight condition.

### Seam stamper

- Initial installation retains all declared seams and declaration order. Subsequent changes collect added/attribute-changed subtrees and parent nodes, then merge work into one animation frame.
- Match `:has(> ...)` seams against the mutation parent itself, covering a composer card or sidebar column inserted directly into an existing parent.
- Preserve dependent seam order, so inputbar/trajectory/surface attributes are available before spotlight seams query them.
- Cache document-first matches. Local candidates compare document order against the cached first match. Removal, movement or selector invalidation of the cached first match triggers a targeted document lookup for that seam. Existing historical stamps remain in place, as in the previous implementation.
- Text-only childList changes skip seam discovery. A composer-local query refreshes the on-air lamp only when its bar is affected. The on-air attribute writes only when its value changes. Observe aria-label so a retained stop button changing its label also updates the lamp.
- Observe selector inputs (class, composer card, composer overlay, rightbar column, dock slot), excluding the generated attributes to avoid feedback. Dispose cancels pending work and releases local references.

## Verification

Passing commands:

```powershell
node tests/issue-12-census-seams.mjs
node tests/issue-12-census-seams.mjs --baseline
node node_modules/typescript/bin/tsc --noEmit --target ES2022 --module ESNext --lib DOM,DOM.Iterable,ES2022 --skipLibCheck --strict src/client/role-census.ts src/client/seam-stamper.ts
git diff --check -- src/client/role-census.ts src/client/seam-stamper.ts tests/issue-12-census-seams.mjs
```

Expected-failure negative controls, independently executed and observed exiting 1:

```powershell
node tests/issue-12-census-seams.mjs --original-role-census
# Fails: census batches geometry reads before stamp commits; actual 4–5 in repeated runs, expected 0.
# Its metrics also reproduce one delayed full-root enumeration.
node tests/issue-12-census-seams.mjs --original-seam-stamper
# Fails: text streaming never runs global seam selectors; actual 16, expected 0.
```

The positive suite verifies ordinary pane roles; fullscreen rightbar remains a pane rather than viewport ground; question's existing family rim retains ownership; code/terminal/opt-out/own-layer/fixed-panel exclusions; a pseudo-painted overlay keeps `veil=before` and no spotlight; inherited hidden and transparent host paint changes clear descendant roles and restore them when reversed; one-face mutation coalescing; spotlight inline style suppression; removal count cleanup and reinsertion; stop-button add/remove lamp transitions; new composer parent and trajectory dependent seams; document-first header successor after removal; rescan counts; census disposal.

The first fixture attempt used TypeScript ModuleKind.None, which emitted CommonJS export initialization into the browser context. The script was corrected to ESNext with export declarations stripped before taking baseline measurements. This was a test-loader issue; source fixes followed the successful original-source reproduction.

## Limits and integration follow-up

- This test uses real Chromium layout plus focused material rules, not the complete shipped CSS bundle or a live Desktop session. Lead owns the unified build, existing shipped-CSS suites, broad regression and deployed acceptance.
- The counters prove enumeration/query/ordering reductions, not end-to-end FPS, power consumption, INP or eliminated GPU costs. No claim is made about full-window filters; anchor and own-layer exclusions remain in effect.
- The 6 ms budget is adaptive, not a hard deadline: a slow individual style/layout transaction can exceed it, and affected-subtree discovery precedes the measurement budget. Each batch is capped at 64 and restored before yielding.
- Meaningful ancestor changes can legitimately invalidate large subtrees. Initial load, resize, explicit rescan and replacement of a cached first seam can legitimately inspect global state. The normal local mutation path avoids periodic global work.
- Retained first-match stamps intentionally keep the previous idempotent additive semantics. The module does not remove historical seam attributes from nodes that cease matching; removing such attributes would be a separate behavioral change.
- Chrome fixtures/profiles live under unique `outputs/issue-12-census-seams/run-*` directories inside the workspace for inspection. The owned Chrome process is terminated in `finally`; generated files stay within that dedicated output directory.
