/**
 * Surface cover — automatic coverage, closed.
 *
 * The precise rules in `mineradio.module.css` name surfaces; the L0/L1 sweeps
 * guess at them from CSS-module word roots. Both depend on the host keeping
 * its class vocabulary. This module removes that dependency: it reads what the
 * app actually PAINTS (the computed background) and stamps what it finds, so a
 * surface added or renamed by a host release is covered on first paint.
 *
 * Signature (the same one the audit reports on, so the two can never drift):
 * an element at least 80px on both axes whose computed background-color is
 * fully opaque. Everything the theme already reaches computes to alpha < 1
 * (token-tinted fills, family glass, lifted bones), so an opaque hit is by
 * construction a stock-painted face no rule has met yet.
 *
 * Two outcomes, mirroring the L0/L1 split:
 *   data-dsh-aqua-bone    — a structural slab (full-bleed, or a large
 *                           un-rounded wrapper): only the fill is lifted, so
 *                           the ambient ground shows through it.
 *   data-dsh-aqua-auto    — a bounded surface: takes the family glass recipe.
 *
 * Cost control: the first pass sweeps the tree in rAF slices under a time
 * budget; afterwards a MutationObserver feeds only newly added subtrees, and
 * decisions are memoized per element so nothing is measured twice.
 */

/** The theme attribute the whole layer is gated on. */
const AQUA = 'data-dsh-aqua'
/** Stamp for a bounded surface that takes the family glass. */
export const COVER_SURFACE_ATTRIBUTE = 'data-dsh-aqua-auto'
/** Stamp for a structural slab that only has its fill lifted. */
export const COVER_BONE_ATTRIBUTE = 'data-dsh-aqua-bone'
/** Opt-out for a host element that must stay stock-painted. */
export const COVER_IGNORE_ATTRIBUTE = 'data-dsh-aqua-cover-ignore'

/** Elements that never count as un-adapted slabs. */
const SKIP_SELECTOR = [
  // The theme's own mounted surfaces.
  '[data-dsh-aqua-ambient]', '[data-dsh-aqua-wallpaper]', '[data-dsh-aqua-fade]',
  '[data-dsh-aqua-fluid-canvas]', '[data-dsh-aqua-spot]', '[data-dsh-aqua-halo]',
  "[class*='mineradio']", "[class*='Mineradio']", "[class*='fonts_']",
  // Media and readability surfaces legitimately stay painted.
  'img', 'video', 'canvas', 'svg', 'picture', 'iframe', 'pre', 'code', '.xterm',
  "[class*='code']", "[class*='Code']",
  "[class*='terminal']", "[class*='Terminal']",
  "[class*='markdown']", "[class*='Markdown']",
  "[class*='highlight']", "[class*='Highlight']",
  "[class*='progress']", "[class*='Progress']",
  "[role='progressbar']",
  // Painted on purpose: the native-vibrancy backing plate, image plates and
  // data plots read as content, not as chrome.
  "[class*='backing']",
  "[class*='chart']", "[class*='Chart']", "[class*='plot']", "[class*='Plot']",
  "[class*='sparkline']", "[class*='Sparkline']", "[class*='thumb']", "[class*='Thumb']",
  `[${COVER_IGNORE_ATTRIBUTE}]`,
].join(', ')

/** Smallest slab worth covering (px, both axes) — surfaces, not icons. */
const MIN_SIZE = 80
/** Computed alpha at or above this counts as "stock-painted opaque". */
const OPAQUE_ALPHA = 0.98
/** A slab this large relative to the viewport is structural, not a surface. */
const BONE_AREA_RATIO = 0.45
/** Full-bleed threshold (both axes) — always a bone. */
const BONE_VIEWPORT_RATIO = 0.85
/** rAF time budget per frame (ms) — keeps the sweep off the critical path. */
const FRAME_BUDGET_MS = 6
/** Elements handled in one slice before the budget is re-checked. */
const SLICE = 200

/** What the cover has decided so far. */
export interface SurfaceCoverStats {
  /** Bounded surfaces currently wearing the family glass. */
  surfaces: number
  /** Structural slabs whose fill was lifted. */
  bones: number
  /** Elements measured since the layer mounted. */
  measured: number
  /** Sweeps still queued (0 when the cover is idle). */
  pending: number
}

/** Live handle returned by {@link startSurfaceCover}. */
export interface SurfaceCoverHandle {
  /** Re-decide every element (drops the memo, keeps the stamps in place). */
  rescan(): void
  /** Current counters, for the console API and for tests. */
  stats(): SurfaceCoverStats
  /** Drop every stamp and stop watching. */
  dispose(): void
}

/**
 * Parse the alpha out of a computed background-color.
 * @param value - e.g. `rgb(8, 9, 11)` or `rgba(8, 9, 11, 0.55)`.
 * @returns 1 for `rgb()` forms (fully opaque), the parsed alpha otherwise.
 */
function alphaOf(value: string): number {
  const match = /^rgba?\(([^)]+)\)$/i.exec(value.trim())
  if (match === null) return 0
  const parts = match[1].split(/\s*[,/ ]\s*/)
  if (parts.length < 4) return 1
  const alpha = Number.parseFloat(parts[3])
  return Number.isNaN(alpha) ? 1 : alpha
}

/**
 * Start covering un-adapted host surfaces.
 * @returns a handle that owns the stamps and the observer.
 */
export function startSurfaceCover(): SurfaceCoverHandle {
  let decided = new WeakSet<Element>()
  let queue: Element[] = []
  /** Read cursor into `queue`; `shift()` on a 10k-element sweep is O(n²). */
  let cursor = 0
  let queued = new WeakSet<Element>()
  let frame: number | undefined
  let sweepTimer: number | undefined
  let resizeTimer: number | undefined
  let disposed = false
  let surfaces = 0
  let bones = 0
  let measured = 0

  const stampOf = (el: Element): string | null =>
    el.hasAttribute(COVER_SURFACE_ATTRIBUTE) ? COVER_SURFACE_ATTRIBUTE
      : el.hasAttribute(COVER_BONE_ATTRIBUTE) ? COVER_BONE_ATTRIBUTE
        : null

  /** Release one element's stamp and forget its decision. */
  const release = (el: Element): void => {
    const stamp = stampOf(el)
    if (stamp === null) return
    el.removeAttribute(stamp)
    if (stamp === COVER_SURFACE_ATTRIBUTE) surfaces -= 1
    else bones -= 1
  }

  /** Enqueue one element for a decision (idempotent). */
  const enqueue = (el: Element): void => {
    if (disposed || !el.isConnected || queued.has(el)) return
    // Memoized: a face that was measured keeps its verdict (stamped or
    // deliberately left alone) until something releases it — the attribute,
    // resize and rescan paths delete from `decided` first. Without this the
    // debounced sweeps would re-measure every non-stamped element.
    if (decided.has(el)) return
    queued.add(el)
    queue.push(el)
  }

  /** Enqueue an element and everything under it. */
  const enqueueSubtree = (root: Element): void => {
    enqueue(root)
    for (const el of root.querySelectorAll('*')) enqueue(el)
  }

  /**
   * Decide one element: measure, classify, stamp.
   * @param el - candidate element.
   */
  const decide = (el: Element): void => {
    queued.delete(el)
    if (disposed || !el.isConnected) return
    const previous = stampOf(el)
    decided.add(el)
    measured += 1
    // A re-check (attribute flip, resize, rescan) may have kept an old stamp.
    if (previous !== null) release(el)
    if (!(el instanceof HTMLElement)) return
    // The page ground is painted by the theme's own body rule: skip the two
    // document elements by identity. `#root` must NOT be skipped as an
    // ancestor — the whole app mounts inside it, so a `closest()` blacklist
    // there would silently disable the cover (and the audit) entirely.
    if (el === document.body || el === document.documentElement) return
    if (el.closest(SKIP_SELECTOR) !== null) return
    if (!document.documentElement.hasAttribute(AQUA)) return
    const rect = el.getBoundingClientRect()
    if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) return
    const computed = getComputedStyle(el)
    if (alphaOf(computed.backgroundColor) < OPAQUE_ALPHA) return
    const radius = Number.parseFloat(computed.borderTopLeftRadius)
    const vw = window.innerWidth
    const vh = window.innerHeight
    const fullBleed = rect.width >= vw * BONE_VIEWPORT_RATIO && rect.height >= vh * BONE_VIEWPORT_RATIO
    const oversized = rect.width * rect.height >= vw * vh * BONE_AREA_RATIO
    // Scrollports are ground, not chrome: a gradient + blur over a scrolling
    // column reads as a smear, while lifting the fill lets the ambient show.
    const scrollport = /(auto|scroll)/.test(`${computed.overflowX}${computed.overflowY}`)
    const structural = fullBleed || (oversized && !(radius > 0)) || scrollport
    if (structural) {
      el.setAttribute(COVER_BONE_ATTRIBUTE, '')
      bones += 1
      return
    }
    el.setAttribute(COVER_SURFACE_ATTRIBUTE, '')
    surfaces += 1
  }

  /** Drain the queue under a per-frame time budget. */
  const pump = (): void => {
    frame = undefined
    if (disposed) return
    const deadline = performance.now() + FRAME_BUDGET_MS
    let handled = 0
    while (cursor < queue.length) {
      decide(queue[cursor])
      cursor += 1
      handled += 1
      if (handled >= SLICE && performance.now() >= deadline) break
    }
    if (cursor >= queue.length) {
      queue = []
      cursor = 0
      return
    }
    schedule()
  }

  const schedule = (): void => {
    if (disposed || frame !== undefined) return
    frame = requestAnimationFrame(pump)
  }

  /** Queue the whole tree; already-decided elements cost one WeakSet lookup. */
  const sweep = (): void => {
    if (disposed || document.body === null) return
    for (const el of document.body.querySelectorAll('*')) enqueue(el)
    enqueue(document.body)
    schedule()
  }

  /** Debounced full sweep — coalesces attribute churn (tab and hover flips). */
  const sweepSoon = (): void => {
    if (disposed) return
    if (sweepTimer !== undefined) window.clearTimeout(sweepTimer)
    sweepTimer = window.setTimeout(() => {
      sweepTimer = undefined
      sweep()
    }, 300)
  }

  const observer = new MutationObserver((records) => {
    let needsSweep = false
    for (const record of records) {
      if (record.type === 'childList') {
        for (const node of record.addedNodes) {
          if (node.nodeType === 1) enqueueSubtree(node as Element)
        }
        continue
      }
      // Attribute flip: a surface may have become visible or repainted.
      const target = record.target
      if (target.nodeType === 1) {
        decided.delete(target as Element)
        enqueue(target as Element)
        needsSweep = true
      }
    }
    if (needsSweep) sweepSoon()
    schedule()
  })

  const onResize = (): void => {
    if (resizeTimer !== undefined) window.clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(() => {
      resizeTimer = undefined
      for (const el of document.querySelectorAll(`[${COVER_SURFACE_ATTRIBUTE}], [${COVER_BONE_ATTRIBUTE}]`)) {
        decided.delete(el)
        enqueue(el)
      }
      schedule()
    }, 250)
  }

  const start = (): void => {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'aria-hidden', 'data-active', 'data-state', 'style'],
    })
    window.addEventListener('resize', onResize)
    sweep()
  }

  start()

  return {
    rescan(): void {
      if (disposed) return
      for (const el of document.querySelectorAll(`[${COVER_SURFACE_ATTRIBUTE}], [${COVER_BONE_ATTRIBUTE}]`)) {
        el.removeAttribute(COVER_SURFACE_ATTRIBUTE)
        el.removeAttribute(COVER_BONE_ATTRIBUTE)
      }
      surfaces = 0
      bones = 0
      decided = new WeakSet<Element>()
      queue = []
      cursor = 0
      queued = new WeakSet<Element>()
      sweep()
    },
    stats(): SurfaceCoverStats {
      return { surfaces, bones, measured, pending: Math.max(0, queue.length - cursor) }
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      observer.disconnect()
      window.removeEventListener('resize', onResize)
      if (frame !== undefined) cancelAnimationFrame(frame)
      if (sweepTimer !== undefined) window.clearTimeout(sweepTimer)
      if (resizeTimer !== undefined) window.clearTimeout(resizeTimer)
      queue = []
      cursor = 0
      for (const el of document.querySelectorAll(`[${COVER_SURFACE_ATTRIBUTE}], [${COVER_BONE_ATTRIBUTE}]`)) {
        el.removeAttribute(COVER_SURFACE_ATTRIBUTE)
        el.removeAttribute(COVER_BONE_ATTRIBUTE)
      }
    },
  }
}
