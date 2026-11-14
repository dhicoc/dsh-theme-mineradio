# Agent Note: Reopen Issues 9 and 10 around visible state contracts

Status: implemented

## Problem

Issues #9 and #10 were closed from synthetic checks that did not model the reported transitions. The old #9 test asserted census roles on custom panes, but the live push panel, DockKit pane, tab body and file root all had no background image or backdrop filter. It tested only one composer transform, not the reported question takeover background. The #10 test placed a fixed button directly in a nonzero mock column; the real Windows column becomes zero-width and Mineradio's overflow hidden clipped both host-fixed caption controls after maximize, collapse and restore.

## Decision

Use deterministic stable-attribute state rules for the reported surfaces:

- An open rightbar's active DockKit content pane owns family glass. The absolute panel remains filter/transform-free; collapsed panels own no blur.
- QuestionComposer's `data-question-key > section` owns one family-glass plate. Detached session-header styling applies only to `header[data-window-drag]`, so the nested question header keeps host spacing and no nested blur.
- A collapsed Windows sidebar column remains overflow visible so its fixed toggle survives the zero-width track across maximize/restore. Mineradio hides the host-fixed New Session shortcut in this state and reclaims its menu gap, leaving one unambiguous sidebar control.
- Existing spotlight gates remain: session header, sidebar, chat flow, composer and census/question panes never receive a 3D text-blurring transform.

Tests consume CSS from built `lib/client.js` and real host AppFrame, SidebarRoot, SidebarRight, DockKit and QuestionComposer styles. Broad activation of dormant generic L1 selectors was evaluated and rejected after Desktop showed every sidebar panel row receiving an unwanted border; this repair stays scoped to reported surfaces.

## Alternatives considered

- Trust role census to reclassify after every transition: attractive reuse, but live panes already paint transparent after the sweep, so there is no plate to classify and timing remains observable.
- Blur the whole rightbar panel: one rule covers everything, but creates a containing block for fixed DockKit floats and leaves a fullscreen-sized filter when collapsed.
- Keep both host-fixed Windows buttons visible: matches current host CSS, but the issue reporter's expected affordance is the sidebar toggle; releasing the zero-width clip also exposed an orphan New Session circle below the titlebar.
- Fix the global regex CSS minifier and activate all catch-all L1 rules: semantically cleaner in isolation, but it changes unrelated surfaces and visibly over-styles sidebar rows. It requires a separate audited migration.

## Consequences

- #9 state transitions are synchronous and visual: push/fullscreen open have glass; collapse has no overlay; reopen restores glass. Question takeover keeps one readable card and sharp text.
- #10 retains a visible, hit-testable toggle at x=12 through maximized and restored widths. The titlebar does not show the orphan New Session button; New Session remains available when expanded and through its shortcut.
- The implementation depends on stable host data attributes and scoped CSS-module word roots, not synthetic classes or mutation timing.

## Verification

Desktop reproduced both defects before the change: live rightbar surfaces all reported no material, and maximize-collapse-restore removed the sidebar toggle. After the change, the original rightbar sequence passes visually; the restored titlebar toggle remains visible. Built-bundle tests cover 96 rightbar combinations plus two Windows widths, question-card material, nested header isolation and text-transform rejection. Independent negative controls remove rightbar glass, question glass, overflow visibility and the New Session hide rule; each must fail. Full pipeline results are recorded in the task log before issue closure.
