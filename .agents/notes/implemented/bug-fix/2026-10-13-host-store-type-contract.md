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
- Existing settings hooks retain their types. The independent custom text-color feature remains in the original working copy and is outside this integration branch.

## Verification

The strict production and compile-only contract gates pass on the isolated issue-fix branch. The fixture checks source and published declarations together, including ten expected-error assertions for invalid selectors and bound action parameters. Runtime tests exercise module fallback, default exports, selection priority and settings sync/revision guards; all nine pass. Esbuild import metadata reports zero static host-engine imports.

Declarations are regenerated with the normal TypeScript configuration before the contract fixture runs. The fixture shares production ambient file-picker declarations. The independent custom text-color feature stays outside this branch; the contract fixture checks the already-published state fields.
