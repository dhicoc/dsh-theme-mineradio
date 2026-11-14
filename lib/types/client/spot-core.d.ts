/**
 * Spot geometry + overlay maintenance, shared by the spotlight/tilt
 * controller (spotlight.ts).
 *
 * A "spot" is a floating-glass pane stamped with `data-dsh-aqua-spot` by the
 * seam-stamper. One injected overlay lives inside a spot:
 * `data-dsh-aqua-glow` — the cursor glow surface (geometry set by the hover
 * controller; the radial fill lives in the stylesheet). It is re-attached
 * after React re-renders wipe it (one shared MutationObserver).
 */
/** Seam attribute marking a floating-glass pane as a spotlight target. */
export declare const SPOT_ATTR = "data-dsh-aqua-spot";
/**
 * Attribute the role census puts on a pane large enough to earn the spotlight.
 *
 * The spotlight used to find its panes only through {@link SPOT_ATTR}, which the seam
 * stamper writes onto five hand-picked selectors. The census marks far more panes than
 * that (any in-flow face over `POLICY.spotArea`), and those marks reached the stylesheet
 * but nothing else — so a large card got `position: relative` and `isolation: isolate`
 * and then no glow, because the pointer feed had never heard of it. Including the role
 * marker in the selector is what connects the census to the existing glow machinery.
 */
export declare const ROLE_SPOT_ATTR = "data-md-spot";
/** Attribute on the injected glow overlay div. */
export declare const GLOW_ATTR = "data-dsh-aqua-glow";
/** Marker set on a pane while the pointer is inside it. */
export declare const ON_ATTR = "data-spot-on";
/** Selector matching every stamped pane, from either marker. */
export declare const SPOT_SELECTOR = "[data-dsh-aqua-spot], [data-md-spot]";
/** Nearest stamped pane from an event target (null when outside all panes). */
export declare function closestSpot(target: EventTarget | null): HTMLElement | null;
/** Every stamped pane in document order. */
export declare function spotElements(): HTMLElement[];
/**
 * The visible glass region of a pane (viewport rect). The fused
 * composer+stats spot is the wider invisible inputbar wrapper — its glass is
 * the union of the composer card and the docked stats band, so the wrapper's
 * side gutters stay outside every effect.
 */
export declare function visualRect(spot: HTMLElement): DOMRect;
/** Is the pointer over the visible glass of the pane? */
export declare function inside(visual: DOMRect, clientX: number, clientY: number): boolean;
/**
 * The visible glass region of a pane in the pane's own local space
 * (untransformed — safe to measure while tilted). For the fused
 * composer+stats spot this is the union of the composer card and the docked
 * stats band; for the other panes it is the pane's own box.
 */
export declare function glassLocalRect(spot: HTMLElement): {
    left: number;
    top: number;
    width: number;
    height: number;
};
/** Ensure the pane carries exactly one glow overlay div. */
export declare function ensureGlow(spot: HTMLElement): HTMLElement;
/**
 * One shared observer + resize feed: keeps the glow divs glued to the panes
 * through React re-renders and notifies the caller of DOM/layout changes
 * (the caller coalesces the callbacks).
 * @returns a disposer that removes every injected glow div.
 */
export declare function startOverlayKeeper(onChange: () => void): () => void;
