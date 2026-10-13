# Agent Note: Isolated patch release while preserving pending feature changes

Status: implemented

## Problem

The working tree contains an unrelated, uncommitted global text-color feature mixed into source CSS and lib/client.js. Publishing the current bundle alone would include that feature without matching committed sources; staging everything would silently broaden this requested fullscreen bug-fix release.

## Decision

Build version 3.0.5 from the current HEAD plus only the fullscreen isolation rule, its regression, fixtures, decision note and release metadata in a separate staging directory inside the existing project workspace. Stage the isolated CSS and built client as Git blobs; preserve the user's active source and bundle byte-for-byte. Stage the remaining release-owned paths explicitly, never git add the entire working tree.

Push main and v3.0.5 through the existing tag-triggered workflows. Do not also run local npm publish or manually create a second Release. Observe the workflow result and verify npm registry version, latest tag and package contents. No credentials are copied into the staging tree.

## Alternatives considered

- Commit the whole working tree: simpler, but includes the pending text-color feature and changes the release scope without a direct request.
- Commit only CSS while shipping the existing bundle: preserves source files but makes the published bundle disagree with the committed source.
- Publish locally while also pushing the release tag: could finish sooner but races the existing npm Actions publisher, which previously produced a duplicate release failure.

## Consequences

- The remote patch release is reproducible and contains only the requested bug fix. User-owned feature edits remain local and can be reviewed/released separately.
- Git status intentionally remains dirty for the preserved feature and bundle after the release commit. The staging artifact is not the running Desktop bundle; both receive the same isolation rule.
- The standalone regression carries host CSS fixtures so it runs from an ordinary clone without a separate dsh-source checkout. Tests leave ignored outputs in the selected theme root.

## Verification

The isolated built bundle passes 96 rendering/state combinations; removal of isolation fails as required. npm pack dry-run reports version 3.0.5. Before/after SHA-256 comparisons protect all untouched user-owned source files and the working client bundle. The staged CSS is audited to contain no global text-color substitutions, and the staged bundle contains no customTextColor feature. Note validators and staged whitespace checks run before commit. Remote and registry results are recorded after execution.
