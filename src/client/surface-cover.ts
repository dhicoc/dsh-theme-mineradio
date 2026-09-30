/**
 * Surface cover — automatic coverage, closed.
 *
 * The precise rules in `mineradio.module.css` name surfaces; the L0/L1 sweeps
 * guess at them from CSS-module word roots. Both depend on the host keeping
 * its class vocabulary, and both miss faces painted from tokens the theme
 * never overrides (`--dsw-static-neutral-*`) or whose class root is outside
 * the vocabulary (`header`, `file`, `row`). This module removes that
 * dependency: it reads what the app actually PAINTS and dresses what it finds,
 * so a surface added or renamed by a host release is covered on first paint.
 *
 * Signature: an element at least 96×24 (and 6000px²) that paints something —
 * any background tint, solid fill or gradient wash. The whole app mounts
 * inside `#root` and tool cards live inside `[class*='markdown']` wrappers, so
 * the blacklist matches the element ITSELF, never its ancestors.
 *
 * Three outcomes:
 *   data-dsh-aqua-auto   — the family glass: gradient fill + specular rim +
 *                          hairline, plus the blur knob on larger faces and a
 *                          short transition so the pane reacts like the rest.
 *   data-dsh-aqua-bone   — viewport-filling page ground: fill lifted only, so
 *                          the ambient backdrop reaches the eye.
 *   data-dsh-aqua-spot   — pane-scale faces also join the spotlight/tilt set
 *                          (spot-core maintains their glow overlay).
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
/** Extra stamp for small faces: family glass without the backdrop blur. */
export const COVER_FLAT_ATTRIBUTE = 'data-dsh-aqua-flat'
/** Extra stamp for pane-scale faces: join the spotlight/tilt set. The seam
 *  stamper also uses this attribute, so the cover writes the sentinel value
 *  `cover` and only ever removes its own — a hand-stamped pane keeps its spot. */
export const COVER_SPOT_ATTRIBUTE = 'data-dsh-aqua-spot'
/** Value marking a spot the cover owns (an empty value belongs to the seams). */
const COVER_SPOT_OWNER = 'cover'
/** Stamp for faces the HOST paints with a pseudo-element: value is the pseudo
 *  (`before`/`after`). Dressing the element itself would stay hidden behind
 *  that veil — the agent-team popover (`EBLgjq_panel::before`) is exactly this
 *  shape, which is why every element-measuring rule missed it. */
export const COVER_VEIL_ATTRIBUTE = 'data-dsh-aqua-veil'
/** Opt-out for a host element that must stay stock-painted. */
export const COVER_IGNORE_ATTRIBUTE = 'data-dsh-aqua-cover-ignore'
/** Every stamp this module owns; used for release and for teardown. */
const OWN_ATTRIBUTES = [
  COVER_SURFACE_ATTRIBUTE, COVER_BONE_ATTRIBUTE, COVER_FLAT_ATTRIBUTE,
  COVER_SPOT_ATTRIBUTE, COVER_VEIL_ATTRIBUTE,
] as const

/** Elements that never count as un-adapted slabs.
 *
 *  Matched against the element ITSELF (`matches`), never against ancestors:
 *  the whole app mounts inside `#root`, tool cards live inside `[class*=
 *  'markdown']` wrappers and the transcript inside scroll containers, so an
 *  ancestor blacklist would exempt exactly the faces users report. An element
 *  is only "readability content" when it paints that content itself. */
const SKIP_SELECTOR = [
  // Media and readability surfaces legitimately stay painted.
  'img', 'video', 'canvas', 'svg', 'picture', 'iframe', 'pre', 'code', 'kbd', 'samp', '.xterm',
  'input', 'textarea', 'select', 'option',
  "[class*='code']", "[class*='Code']",
  "[class*='terminal']", "[class*='Terminal']",
  "[class*='markdown']", "[class*='Markdown']",
  "[class*='highlight']", "[class*='Highlight']",
  "[class*='progress']", "[class*='Progress']",
  "[role='progressbar']", "[role='slider']",
  // Painted on purpose: the native-vibrancy backing plate, image plates, data
  // plots and the theme's own controls read as content, not as chrome.
  "[class*='backing']",
  "[class*='chart']", "[class*='Chart']", "[class*='plot']", "[class*='Plot']",
  "[class*='sparkline']", "[class*='Sparkline']", "[class*='thumb']", "[class*='Thumb']",
  "[class*='scrollbar']", "[class*='Scrollbar']",
  "[class*='mineradio']", "[class*='Mineradio']", "[class*='fonts_']",
  `[${COVER_IGNORE_ATTRIBUTE}]`,
].join(', ')

/** The theme's own mounted layers — skip anything inside them. */
const OWN_LAYER_SELECTOR = [
  '[data-dsh-aqua-ambient]', '[data-dsh-aqua-wallpaper]', '[data-dsh-aqua-fade]',
  '[data-dsh-aqua-fluid-canvas]', '[data-dsh-aqua-glow]',
].join(', ')

/** Smallest face worth dressing (px) — a surface, not an icon. Width, height
 *  and area must all clear: a 40px tile or a 60×20 badge stays stock, while
 *  the 60px-tall "edited N files" card (≈300×60) is a face. */
const MIN_WIDTH = 96
const MIN_HEIGHT = 24
const MIN_AREA = 6000
/** Alpha at or above this counts as "painted" (hover tints sit near 0.10). */
const PAINT_ALPHA = 0.15
/** Above this area the family glass also carries the backdrop blur. */
const BLUR_AREA = 20000
/** Above this share of the viewport the blur is dropped again: a whole column
 *  reads as a flat slab once its backdrop is smoothed. */
const LARGE_AREA_RATIO = 0.25
/** Pane-scale faces additionally join the spotlight/tilt set. */
const PANE_AREA = 60000
/** Full-bleed on both axes — the page ground, not a face. */
const GROUND_VIEWPORT_RATIO = 0.85
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
  /** Faces that also joined the spotlight/tilt set. */
  spots: number
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
 *
 * Chrome resolves `color-mix()` fills to the modern `color(srgb … / a)` form,
 * and the theme's own token ladder is built from `color-mix()` — so a parser
 * that only understands `rgb()/rgba()` reads every mixed token as fully
 * transparent and silently skips the faces that need the cover most (the
 * 92%-alpha menu/dialog plate among them).
 *
 * @param value - e.g. `rgb(8, 9, 11)`, `rgba(8, 9, 11, 0.55)`,
 *   `rgb(8 9 11 / 0.5)` or `color(srgb 0.03 0.03 0.04 / 0.92)`.
 * @returns 1 for a fully opaque color, the parsed alpha otherwise.
 */
export function paintedAlpha(value: string): number {
  const text = value.trim().toLowerCase()
  if (text === '' || text === 'transparent' || text === 'none') return 0
  if (text === 'currentcolor') return 0
  // Modern syntaxes carry the alpha after a slash.
  const slash = text.lastIndexOf('/')
  if (slash !== -1) {
    const tail = text.slice(slash + 1).replace(/[^0-9.%]/g, '')
    const parsed = Number.parseFloat(tail)
    if (Number.isNaN(parsed)) return 1
    return tail.includes('%') ? parsed / 100 : parsed
  }
  // Legacy comma form: only rgba()/hsla() carry a fourth component.
  const legacy = /^(?:rgba|hsla)\(([^)]+)\)$/.exec(text)
  if (legacy !== null) {
    const parts = legacy[1].split(',')
    if (parts.length < 4) return 1
    const parsed = Number.parseFloat(parts[3])
    return Number.isNaN(parsed) ? 1 : parsed
  }
  // Any other resolved color function without a slash is opaque; unknown
  // keywords (inherit, a named color we cannot resolve here) are treated as
  // unpainted so the cover never guesses.
  return /^(?:rgb|hsl|hwb|lab|lch|oklab|oklch|color|light-dark|color-mix)\(/.test(text) ? 1 : 0
}

const alphaOf = paintedAlpha

/**
 * Is a pseudo-element painting the face for its host?
 *
 * Host popovers and menus commonly keep the element itself transparent and
 * paint the visible plate on `::before` (`content:""; position:absolute;
 * inset:0; background: var(--dsw-specific-menu)`). Measuring the element alone
 * reads "no background" and skips exactly the faces users notice most.
 *
 * @param el - candidate host element.
 * @param rect - the element's border box.
 * @returns `before` / `after` when that pseudo covers the box with a paint,
 *   otherwise null.
 */
function veilOf(el: Element, rect: DOMRect): 'before' | 'after' | null {
  for (const pseudo of ['::before', '::after'] as const) {
    const style = getComputedStyle(el, pseudo)
    const content = style.content
    if (content === 'none' || content === 'normal' || content === '') continue
    if (style.position !== 'absolute' && style.position !== 'fixed') continue
    if (style.display === 'none' || style.visibility === 'hidden') continue
    if (alphaOf(style.backgroundColor) < PAINT_ALPHA && style.backgroundImage === 'none') continue
    // Cover test: pinned to all four edges, or sized to the box.
    const near = (value: string): boolean => {
      const px = Number.parseFloat(value)
      return Number.isNaN(px) || Math.abs(px) <= 2
    }
    const pinned = near(style.top) && near(style.bottom) && near(style.left) && near(style.right)
    const sized = Number.parseFloat(style.width) >= rect.width - 2
      && Number.parseFloat(style.height) >= rect.height - 2
    if (!pinned && !sized) continue
    return pseudo === '::before' ? 'before' : 'after'
  }
  return null
}

/**
 * The shared face signature. The audit reports on exactly what the cover
 * dresses, so the two can never drift apart — export the numbers instead of
 * restating them.
 */
export const SURFACE_POLICY = {
  /** Minimum width of a face (px). */
  minWidth: MIN_WIDTH,
  /** Minimum height of a face (px). */
  minHeight: MIN_HEIGHT,
  /** Minimum area of a face (px²). */
  minArea: MIN_AREA,
  /** Alpha at or above which a background counts as painted. */
  paintAlpha: PAINT_ALPHA,
} as const

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
  let spots = 0
  let measured = 0

  const stampOf = (el: Element): string | null =>
    el.hasAttribute(COVER_SURFACE_ATTRIBUTE) ? COVER_SURFACE_ATTRIBUTE
      : el.hasAttribute(COVER_VEIL_ATTRIBUTE) ? COVER_VEIL_ATTRIBUTE
        : el.hasAttribute(COVER_BONE_ATTRIBUTE) ? COVER_BONE_ATTRIBUTE
          : null

  /** Release one element's stamps and forget its decision (idempotent). */
  const release = (el: Element): void => {
    const stamp = stampOf(el)
    if (stamp === null && !el.hasAttribute(COVER_FLAT_ATTRIBUTE)) return
    if (el.getAttribute(COVER_SPOT_ATTRIBUTE) === COVER_SPOT_OWNER) {
      el.removeAttribute(COVER_SPOT_ATTRIBUTE)
      spots -= 1
    }
    el.removeAttribute(COVER_SURFACE_ATTRIBUTE)
    el.removeAttribute(COVER_VEIL_ATTRIBUTE)
    el.removeAttribute(COVER_BONE_ATTRIBUTE)
    el.removeAttribute(COVER_FLAT_ATTRIBUTE)
    if (stamp === COVER_SURFACE_ATTRIBUTE || stamp === COVER_VEIL_ATTRIBUTE) surfaces -= 1
    else if (stamp === COVER_BONE_ATTRIBUTE) bones -= 1
  }

  /** Drop every stamp this module owns, anywhere in the tree. */
  const clearAll = (): void => {
    const selector = [
      ...OWN_ATTRIBUTES.map((attribute) => `[${attribute}]`),
      `[${COVER_SPOT_ATTRIBUTE}='${COVER_SPOT_OWNER}']`,
    ].join(', ')
    for (const el of document.querySelectorAll(selector)) {
      el.removeAttribute(COVER_SURFACE_ATTRIBUTE)
      el.removeAttribute(COVER_VEIL_ATTRIBUTE)
      el.removeAttribute(COVER_BONE_ATTRIBUTE)
      el.removeAttribute(COVER_FLAT_ATTRIBUTE)
      if (el.getAttribute(COVER_SPOT_ATTRIBUTE) === COVER_SPOT_OWNER) el.removeAttribute(COVER_SPOT_ATTRIBUTE)
    }
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
    decided.add(el)
    measured += 1
    // A re-check (attribute flip, resize, rescan) may have kept old stamps.
    // Remember whether the rim we are about to see could be our own: the
    // family recipe's first inset is applied BY our stamp, so an element we
    // dressed must never be mistaken for a hand-dressed one and released.
    const ours = el.hasAttribute(COVER_SURFACE_ATTRIBUTE) || el.hasAttribute(COVER_VEIL_ATTRIBUTE)
    release(el)
    if (!(el instanceof HTMLElement)) return
    // The page ground is painted by the theme's own body rule: skip the two
    // document elements by identity. `#root` must NOT be skipped as an
    // ancestor — the whole app mounts inside it, so a `closest()` blacklist
    // there would silently disable the cover (and the audit) entirely.
    if (el === document.body || el === document.documentElement) return
    if (el.closest(OWN_LAYER_SELECTOR) !== null) return
    if (el.matches(SKIP_SELECTOR)) return
    if (!document.documentElement.hasAttribute(AQUA)) return
    const rect = el.getBoundingClientRect()
    if (rect.width < MIN_WIDTH || rect.height < MIN_HEIGHT) return
    if (rect.width * rect.height < MIN_AREA) return
    const computed = getComputedStyle(el)
    // Hand-dressed by a precise rule: the family rim is `inset 0 0 0 1px …`,
    // and only the theme's own glass carries it. Leave those alone — the auto
    // rule sits at (0,2,0) and would otherwise out-specify precise rules such
    // as `[data-dsh-float] header` (0,1,1), flattening a hand-tuned pane (its
    // blur and brightness) into a plain plate.
    if (!ours && computed.boxShadow.includes('inset')) return
    const alpha = alphaOf(computed.backgroundColor)
    // A face paints something: a tint, a solid fill or a gradient wash. A
    // fully transparent box is a layout wrapper — unless its pseudo-element
    // paints the plate for it (host popovers do exactly that).
    const ownPaint = alpha >= PAINT_ALPHA || computed.backgroundImage !== 'none'
    const veil = ownPaint ? null : veilOf(el, rect)
    if (!ownPaint && veil === null) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const ground = rect.width >= vw * GROUND_VIEWPORT_RATIO && rect.height >= vh * GROUND_VIEWPORT_RATIO
    const area = rect.width * rect.height
    // Structural, in-flow slabs (the conversation column is `.Dc7zOa_root`,
    // painted with `--dsw-alias-bg-base`; the frame columns too) are the
    // fluid's window — the L0 skeleton layer lifts their stock fill so the
    // ambient backdrop shows through. Filming them, even with the light veil,
    // puts a plate back over the fluid: that IS the "ink fill" look. Overlays
    // (fixed/absolute: dialogs, popovers) keep the film — they need a body.
    const position = computed.position
    const inFlow = position === 'static' || position === 'relative'
    const structural = ground || (area > vw * vh * LARGE_AREA_RATIO && inFlow)
    if (structural && veil === null) {
      el.setAttribute(COVER_BONE_ATTRIBUTE, '')
      bones += 1
      return
    }
    if (veil === null) el.setAttribute(COVER_SURFACE_ATTRIBUTE, '')
    else el.setAttribute(COVER_VEIL_ATTRIBUTE, veil)
    surfaces += 1
    // Blur belongs to panes: below the blur floor it costs more than it shows.
    if (area < BLUR_AREA) el.setAttribute(COVER_FLAT_ATTRIBUTE, '')
    // Pane-scale faces also join the spotlight/tilt set (the glow overlay is
    // maintained by spot-core for every stamped pane). Absolute/fixed panes
    // are left out: the spot rule sets `position: relative`, which would
    // re-anchor them, and `isolation` would trap their popovers.
    if (area >= PANE_AREA && inFlow) {
      // Never clobber a spot the seam stamper already placed.
      if (!el.hasAttribute(COVER_SPOT_ATTRIBUTE)) {
        el.setAttribute(COVER_SPOT_ATTRIBUTE, COVER_SPOT_OWNER)
        spots += 1
      }
    }
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
      for (const el of document.querySelectorAll(OWN_ATTRIBUTES.map((a) => `[${a}]`).join(', '))) {
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
      clearAll()
      surfaces = 0
      bones = 0
      spots = 0
      decided = new WeakSet<Element>()
      queue = []
      cursor = 0
      queued = new WeakSet<Element>()
      sweep()
    },
    stats(): SurfaceCoverStats {
      return { surfaces, bones, spots, measured, pending: Math.max(0, queue.length - cursor) }
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
      clearAll()
    },
  }
}
