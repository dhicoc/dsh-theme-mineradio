/**
 * Cinematic camera for the ambient scene — makes the backdrop read as a 3D
 * stage rather than a flat wallpaper:
 *
 *   1. CURSOR PARALLAX + 3D TILT (the "wow"): the fluid board (far) and the
 *      star-river (near) shift, tilt (rotateX/rotateY under perspective) and
 *      roll at different rates as the pointer moves — the near layer travels
 *      ~2× further, so moving the mouse parallax-reveals real depth.
 *   2. IDLE DRIFT (the "breathe"): a slow low-frequency sine sway + roll so
 *      the scene keeps floating when the pointer is still — a 2D port of
 *      Mineradio's `cineTheta = sin(t*0.08)*0.012` idle orbit.
 *
 * Pure CSS-transform work (one rAF, GPU-composited); reduced-motion renders
 * nothing (the scene stays a clean static frame).
 */
export interface CinemaDriftHandle {
    dispose(): void;
}
/** Start the cinematic camera over the ambient scene. */
export declare function startCinemaDrift(ambient: HTMLElement): CinemaDriftHandle;
