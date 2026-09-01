/**
 * Interactive mesh: the deepseek.com/harness hero's dot-grid decoration —
 * a 90px grid of dots with spring physics that repel from the pointer
 * (radius 140px), the grid lines stretching with them. Faithful port of the
 * site's `h()` grid component (30fps, dpr ≤ 2, idle-pause). Rendered inside
 * the ambient scene behind the app content; pointer-events pass through.
 */
/** Mesh handle: disposal. */
export interface MeshHandle {
    /** Stop the engine and remove the canvas. */
    dispose: () => void;
}
/**
 * Mount the interactive mesh into `host` (the ambient scene).
 * @param host - the container the mesh canvas is appended to.
 * @returns the handle.
 */
export declare function mountMesh(host: HTMLElement): MeshHandle;
