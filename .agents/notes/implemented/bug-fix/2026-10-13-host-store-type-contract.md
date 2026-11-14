# Agent Note: Preserve the host store contract through the dynamic engine adapter

Status: implemented

## Problem

Mineradio's hand-written host adapter makes spec unknown and represents action generics as already-bound callbacks. The official slot conditionals require StoreHandle with a typed StoreSpec and draft-mutator action declarations. As a result BoundActions becomes never, PropsStore loses useStore, registration chooses the no-store overload and callback selectors degrade to implicit any. The adapter's reverse Parameters mapping also fails generic action inference.

## Decision

Use a type-only import of the installed host defineStore declaration and re-export its EngineStoreHandle type. The adapter resolves runtime modules exactly as before: runtime/client, runtime root, then client-store, including default exports. No static value import of the optional host store is emitted.

Declare MineradioRowActions.sync with draft first, followed by the payload and revision. The host BakedActions conditional removes draft for components and inject factories, so existing sync(payload, revision) calls remain unchanged.

Keep strict mode and all source files in the typecheck scope. Run a separate compile-only contract fixture after the production typecheck; it exercises slot registration compatibility, selector field/result types, bound action arity and generic adapter inference. Expected-error cases ensure wrong payloads and selectors do not silently become valid.

## Alternatives considered

- Cast registrations or components to any: small edits, but loses selector/action validation and hides the original StoreHandle mismatch.
- Relax strict or exclude UI files: makes the command green without repairing the cross-file contract and weakens future checks.
- Replace the dynamic resolver with a static store import: gives inference for free but restores the missing-module failure on hosts that only register a runtime engine.

## Consequences

- Store and slot contracts share one public definition rather than drifting local replicas; changes in the installed host declarations are now visible during typecheck.
- Type-only dependencies are erased, preserving compatibility with runtime-only host module tables. Runtime resolver boundary assertions remain confined to the existing adapter.
- Both pending custom text-color selectors and existing settings hooks retain their types. This change does not publish or discard the pending feature.

## Verification

The baseline typecheck errors are recorded in outputs/typecheck-fix-20261013/before.log. The strict production and compile-only contract gates must both pass. Runtime tests exercise module fallback, default exports, selection priority and settings sync/revision guards; bundle import metadata ensures no static host engine dependency is introduced. Rebuild and the existing runtime/fullscreen regressions run after the type changes; final results are recorded after execution.


The contract fixture uses the same source scope as the production program so existing file-system-picker global declarations are available. Published declarations are regenerated alongside source checks: the pre-existing custom text-color feature was present in working source but absent from the old TextStyle enum, so source/published payload assignability is checked too. Formatting-only declaration deltas are restored; runtime feature source is unchanged.

Measured results: the 39 baseline production errors are resolved. Strict production plus source/published contract compilation passes, including 10 expected-error assertions. Removing those assertions produces exactly 10 real compiler errors, showing the negative cases are enforced. The 9 runtime adapter/sync tests pass and esbuild reports zero static host-engine imports. The runtime bundle rebuild succeeds; its minified bytes change, so byte identity is not asserted. Full runtime regression results are recorded after completion.

The rebuilt working client passes all 32 runtime gates, including the 96 fullscreen isolation combinations. Four technical notes validate successfully. This task does not commit, push or publish a new release.
