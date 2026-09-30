/**
 * Role census — the coverage engine for Mineradio 3.0.
 *
 * WHY THIS EXISTS
 * The 2.x theme decided coverage from CSS class-name word roots
 * (`[class*='panel']`, `[class*='bar']`, …) at a fixed (0,2,0) specificity.
 * Measured against the real 0.2.0-rc.2 shell that approach loses: the shell
 * paints `--dsw-alias-bg-base` on `._tabHost_…:not(._float_…)`,
 * `._emptyTabHost_…`, `._tabCell_…`, `._paneBody_…`, `._stripChrome_…`,
 * `._backing_…` — roots the word list never learned — and any host rule above
 * (0,2,0) wins outright. That is why a black plate survived every release.
 * See outputs/harness/mechanism-test.mjs for the measurement.
 *
 * WHAT IT DOES INSTEAD
 * It reads what each element actually PAINTS (computed style + geometry), gives
 * it a ROLE, and stamps that role as an attribute. The stylesheet then targets
 * roles, with `!important` so the declaration wins on priority rather than on a
 * specificity contest it cannot reliably win.
 *
 * Faces the theme has already hand-dressed are left alone: they carry the
 * family rim (`inset 0 0 0 1px …`), and re-dressing them is exactly the
 * regression that flattened the session header card.
 *
 * Everything here is measured; nothing is inferred from a class name.
 */

/** Root attribute that gates the whole stylesheet. */
const AQUA = 'data-dsh-aqua'

/** Role stamp written by the census. */
export const ROLE_ATTRIBUTE = 'data-md-role'

/** Marks a face that also joins the spotlight/tilt set. */
export const SPOT_ATTRIBUTE = 'data-md-spot'

/** Opt-out for a single element (host or user). */
export const IGNORE_ATTRIBUTE = 'data-md-ignore'

/**
 * Content that must stay legible: code, terminal output, form fields and text
 * containers. Glass over these costs readability (a blurred, translucent body
 * behind monospaced text), so the census refuses to stamp them and they keep
 * their stock fill. Enforced at classification time rather than fought over in
 * the stylesheet, where `!important` rules would need a specificity contest.
 *
 * A test may override this through `globalThis.__MD_READABILITY__` so the
 * acceptance probe and the census classify identically from one source of
 * truth (they drifted once, and the drift produced a phantom failure).
 */
const DEFAULT_READABILITY = [
  'pre', 'code', 'kbd', 'samp', 'var', 'textarea', 'input', 'select',
  "[class*='xterm']", "[class*='terminal']", "[class*='Terminal']",
  "[class*='markdown']", "[class*='Markdown']",
  "[class*='bannerWrap']", "[class*='BannerWrap']",
  '[data-code-block-content]', '[data-code-block-banner]',
  '[data-lexical-editor]',
].join(', ')

/** Containers whose whole subtree is readability-owned (code blocks). */
const READABILITY_ROOT = '[data-code-wrap], [class*="xterm"], [class*="terminal"]'

/**
 * Positional anchors the host's in-place `position: fixed` overlays depend on.
 *
 * Measured (outputs/rc2-source/overlays.md): `.frame`, `.overlayLayer`, `.ledger`
 * and `.composerSeat` own containing blocks for overlays rendered in place.
 * `backdrop-filter`, `filter`, `transform` and `contain` each make an element the
 * containing block for its fixed descendants, so dressing one of these
 * re-anchors menus and tooltips application-wide. The census refuses to give them
 * a glass role; `assert-anchors-untouched.mjs` fails the pipeline if that
 * regresses.
 *
 * Matched by the stable `data-*` seams the shell writes, plus the composer seat's
 * own hook. `data-shell-overlay` is the frame-wide overlay layer and is
 * deliberately included: despite its name it is NOT portalled and lives inside
 * the frame's clip box.
 */
const ANCHOR_SELECTOR = [
  '[data-dsh-frame]',
  '[data-shell-overlay]',
  '[data-composer-seat]',
  '[data-dsh-trajectory]',
].join(', ')

function readabilitySelector(): string {
  const override = (globalThis as { __MD_READABILITY__?: string }).__MD_READABILITY__
  return override ?? DEFAULT_READABILITY
}

/** True when the element, or any ancestor, must stay legible. */
function isReadability(el: Element): boolean {
  if (el.matches(readabilitySelector())) return true
  return el.closest(READABILITY_ROOT) !== null
}

/** Roles, in increasing order of "how much glass it should wear". */
export type Role = 'ground' | 'structure' | 'pane' | 'overlay' | 'control' | 'chip'

export const ROLES: readonly Role[] = ['ground', 'structure', 'pane', 'overlay', 'control', 'chip']

interface Policy {
  /** Minimum width in px for an element to count as a face. */
  minWidth: number
  /** Minimum height in px. */
  minHeight: number
  /** Minimum area in px². */
  minArea: number
  /** A background this opaque counts as "paints something". */
  paintAlpha: number
  /** Share of the viewport above which an in-flow slab is structural ground. */
  groundRatio: number
  /** Share of the viewport above which an in-flow painted slab is structure. */
  structureRatio: number
  /** Above this area a pane also joins the spotlight set. */
  spotArea: number
  /** Below this area a painted face is a chip (glass sliver, no blur). */
  chipArea: number
  /** Per-frame time budget in ms for the census loop. */
  frameBudgetMs: number
}

export const POLICY: Policy = {
  minWidth: 96,
  minHeight: 24,
  minArea: 6000,
  paintAlpha: 0.02,
  groundRatio: 0.7,
  structureRatio: 0.25,
  spotArea: 60000,
  chipArea: 24000,
  frameBudgetMs: 6,
}

export interface CensusStats {
  /** Elements measured so far. */
  measured: number
  /** Elements currently carrying a role stamp. */
  stamped: number
  /** Faces the census refused to touch because they already wear the rim. */
  handDressed: number
  /** Queued elements not yet decided. */
  pending: number
  /** Role tally. */
  byRole: Record<Role, number>
}

export interface CensusHandle {
  /** Re-run a full census (state changed without a DOM mutation). */
  rescan(): void
  /** Current counters. */
  stats(): CensusStats
  /** Stop and remove every stamp this module owns. */
  dispose(): void
}

/**
 * Parse the alpha channel out of any CSS colour the engine can produce.
 *
 * Chrome resolves `color-mix()` to `color(srgb r g b / a)`, and the shell uses
 * `color-mix()` for its menu and overlay fills — a parser that only understood
 * `rgb()/rgba()` read those as alpha 0 and skipped them, which is how the
 * agent-team popover escaped coverage. Handles rgb/rgba (comma and slash),
 * `color(srgb …)`, `oklch()`, `#rgb/#rrggbb/#rrggbbaa`, `hsl()`, `transparent`
 * and percentage alpha.
 */
export function alphaOf(value: string): number {
  const v = value.trim().toLowerCase()
  if (v === '' || v === 'transparent' || v === 'none') return 0
  if (v.startsWith('#')) {
    const hex = v.slice(1)
    if (hex.length === 4) return parseInt(hex[3] + hex[3], 16) / 255
    if (hex.length === 8) return parseInt(hex.slice(6, 8), 16) / 255
    return 1
  }
  // Anything with an explicit ` / <alpha>` or `, <alpha>)` tail.
  const slash = /\/([^/)]+)\)\s*$/.exec(v)
  const tail = slash?.[1] ?? /,\s*([\d.]+%?)\s*\)\s*$/.exec(v)?.[1]
  if (tail !== undefined) {
    const t = tail.trim()
    if (t.endsWith('%')) return Number.parseFloat(t) / 100
    const n = Number.parseFloat(t)
    return Number.isNaN(n) ? 1 : n
  }
  return 1
}

/** True when the element already wears the family rim (a hand-dressed pane). */
function hasFamilyRim(style: CSSStyleDeclaration): boolean {
  return style.boxShadow.includes('inset')
}

/** True when the element itself paints a visible face. */
function ownPaintAlpha(style: CSSStyleDeclaration): number {
  return alphaOf(style.backgroundColor)
}

/** Every colour stop in a gradient, for the "is this opaque" question. */
function gradientStops(image: string): number[] {
  if (image === 'none') return []
  const out: number[] = []
  for (const m of image.matchAll(/(rgba?\([^)]*\)|color\([^)]*\)|oklch\([^)]*\)|#[0-9a-f]{3,8})/gi)) {
    out.push(alphaOf(m[1]))
  }
  return out
}

/** Marks a face whose visible plate is painted by a covering pseudo-element. */
export const VEIL_ATTRIBUTE = 'data-md-veil'

/**
 * Detect a pseudo-element that paints the face for its owner.
 *
 * Measured on the live app: the agent-team panel is
 * `.EBLgjq_panel { position: fixed }` with NO background of its own, and its
 * plate comes from
 *   `.EBLgjq_panel::before { content:''; z-index:-1; position:absolute;
 *                            inset:0; background: var(--dsw-specific-menu);
 *                            backdrop-filter: var(--dsw-menu-backdrop-filter) }`
 * A mechanism that only reads the element's own background can never see that
 * plate, which is exactly why the panel stayed unthemed through several
 * releases. The role is therefore stamped on the OWNER, and the stylesheet
 * dresses the pseudo-element instead.
 *
 * @param el - candidate element.
 * @param rect - its border box.
 * @returns which pseudo paints the plate, or null.
 */
function veilOf(el: Element, rect: DOMRect): 'before' | 'after' | null {
  for (const pseudo of ['::before', '::after'] as const) {
    const style = getComputedStyle(el, pseudo)
    if (style.content === 'none' || style.content === '' || style.content === 'normal') continue
    if (style.display === 'none' || style.visibility === 'hidden') continue
    const position = style.position
    if (position !== 'absolute' && position !== 'fixed') continue
    const alpha = alphaOf(style.backgroundColor)
    const paints = alpha >= POLICY.paintAlpha || style.backgroundImage !== 'none'
    if (!paints) continue
    // It must actually cover the box: pinned to all four edges, or sized to it.
    const pinned =
      style.top !== 'auto' && style.right !== 'auto' && style.bottom !== 'auto' && style.left !== 'auto'
    const sized =
      Math.abs(Number.parseFloat(style.width || '0') - rect.width) <= 2 &&
      Math.abs(Number.parseFloat(style.height || '0') - rect.height) <= 2
    if (pinned || sized) return pseudo === '::before' ? 'before' : 'after'
  }
  return null
}

/**
 * Start the role census.
 * @returns handle with rescan/stats/dispose.
 */
export function startRoleCensus(): CensusHandle {
  // Expose the classifier so a test harness measures with the SAME rule the
  // census applies, instead of keeping a second copy that can drift.
  ;(globalThis as { __MD_isReadability__?: (el: Element) => boolean }).__MD_isReadability__ = isReadability
  // Rebindable so rescan() can drop the memo (a WeakSet has no clear()).
  let decidedRef = new WeakSet<Element>()
  const decided = { has: (el: Element) => decidedRef.has(el), add: (el: Element) => decidedRef.add(el), delete: (el: Element) => decidedRef.delete(el), clear: () => { decidedRef = new WeakSet<Element>() } }
  const queued = new Set<Element>()
  let queue: Element[] = []
  let cursor = 0
  let frame: number | undefined
  let timer: number | undefined
  let disposed = false

  let measured = 0
  let stamped = 0
  let handDressed = 0
  const byRole: Record<Role, number> = {
    ground: 0, structure: 0, pane: 0, overlay: 0, control: 0, chip: 0,
  }

  const writeRole = (el: Element, role: Role): void => {
    if (el.getAttribute(ROLE_ATTRIBUTE) !== role) {
      el.setAttribute(ROLE_ATTRIBUTE, role)
      stamped += 1
    }
    byRole[role] += 1
  }

  const clear = (el: Element, previous: Role): void => {
    el.removeAttribute(ROLE_ATTRIBUTE)
    el.removeAttribute(SPOT_ATTRIBUTE)
    el.removeAttribute(VEIL_ATTRIBUTE)
    byRole[previous] -= 1
    stamped -= 1
  }

  /** Decide one element: measure, classify, stamp. */
  const decide = (el: Element): void => {
    queued.delete(el)
    if (disposed || !el.isConnected) return
    decided.add(el)
    measured += 1

    const prior = el.getAttribute(ROLE_ATTRIBUTE) as Role | null
    if (prior !== null) clear(el, prior)

    if (!(el instanceof HTMLElement)) return
    if (el === document.body || el === document.documentElement) return
    if (el.hasAttribute(IGNORE_ATTRIBUTE)) return
    if (!document.documentElement.hasAttribute(AQUA)) return
    if (el.closest(`[${IGNORE_ATTRIBUTE}]`) !== null) return
    // Legibility carve-outs never receive glass; they keep the stock fill.
    if (isReadability(el)) return
    // Positional anchors keep the host's overlay geometry intact.
    if (el.matches(ANCHOR_SELECTOR)) return

    const rect = el.getBoundingClientRect()
    if (rect.width < POLICY.minWidth || rect.height < POLICY.minHeight) return
    const area = rect.width * rect.height
    if (area < POLICY.minArea) return

    const style = getComputedStyle(el)

    // A pane the theme has already hand-dressed keeps its look: the family rim
    // (`inset 0 0 0 1px …`) is its signature, and the 3.0 role rules carry
    // `!important`, so stamping it here would override a tuned pane.
    if (hasFamilyRim(style)) {
      handDressed += 1
      return
    }

    const alpha = ownPaintAlpha(style)
    const image = style.backgroundImage
    const stops = gradientStops(image)
    const paintsColor = alpha >= POLICY.paintAlpha
    const paintsImage = image !== 'none' && (stops.length === 0 || Math.max(...stops) >= POLICY.paintAlpha)
    // A face may paint nothing itself and still be a visible plate, because a
    // covering pseudo-element draws it (the agent-team panel does exactly this).
    const veil = paintsColor || paintsImage ? null : veilOf(el, rect)
    if (!paintsColor && !paintsImage && veil === null) return

    // Record the plate carrier BEFORE any role branch returns: an overlay whose
    // plate lives in ::before must still be marked, or the stylesheet dresses
    // the box and stacks a second glass layer over the pseudo's plate.
    if (veil === null) el.removeAttribute(VEIL_ATTRIBUTE)
    else el.setAttribute(VEIL_ATTRIBUTE, veil)

    const position = style.position
    const inFlow = position === 'static' || position === 'relative'
    const isOverlay =
      position === 'fixed' ||
      position === 'absolute' ||
      el.getAttribute('role') === 'dialog' ||
      el.getAttribute('role') === 'menu' ||
      el.getAttribute('role') === 'tooltip' ||
      el.hasAttribute('popover')

    const vw = window.innerWidth
    const vh = window.innerHeight
    const viewportArea = vw * vh

    // Structural slabs are the fluid's window: the ambient backdrop must reach
    // the eye through them, so they only lose their fill. Painting glass over a
    // whole column is what made the conversation area read as a black plate.
    if (!isOverlay && area >= viewportArea * POLICY.groundRatio) {
      writeRole(el, 'ground')
      return
    }
    if (!isOverlay && inFlow && area >= viewportArea * POLICY.structureRatio) {
      writeRole(el, 'structure')
      return
    }
    if (isOverlay) {
      writeRole(el, 'overlay')
      return
    }

    // Interactive small parts read as controls, not as glass cards.
    const interactive =
      el.tagName === 'BUTTON' ||
      el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' ||
      el.getAttribute('role') === 'tab' ||
      el.getAttribute('role') === 'button'
    const role: Role = interactive ? 'control' : area >= POLICY.chipArea ? 'pane' : 'chip'
    writeRole(el, role)

    // Panes big enough to matter join the spotlight/tilt set. The spot recipe
    // needs `position: relative` and `isolation`, which would re-anchor fixed
    // overlays, so only in-flow faces qualify.
    if (role === 'pane' && area >= POLICY.spotArea && inFlow) {
      el.setAttribute(SPOT_ATTRIBUTE, '')
    }
    if (veil !== null) el.removeAttribute(SPOT_ATTRIBUTE)
  }

  /** Drain the queue inside a per-frame budget. */
  const pump = (): void => {
    frame = undefined
    if (disposed) return
    const deadline = performance.now() + POLICY.frameBudgetMs
    while (cursor < queue.length) {
      decide(queue[cursor])
      cursor += 1
      if (performance.now() >= deadline) break
    }
    if (cursor >= queue.length) {
      queue = []
      cursor = 0
      return
    }
    // Compact the consumed head so long sweeps don't grow without bound.
    if (cursor > 400) {
      queue = queue.slice(cursor)
      cursor = 0
    }
    schedule()
  }

  const schedule = (): void => {
    if (disposed || frame !== undefined) return
    frame = requestAnimationFrame(pump)
  }

  const enqueue = (el: Element): void => {
    if (disposed || !el.isConnected || queued.has(el) || decided.has(el)) return
    queued.add(el)
    queue.push(el)
    schedule()
  }

  const sweep = (): void => {
    const root = document.getElementById('root') ?? document.body
    if (!root) return
    // Memoised per element: a full sweep after a mutation must not re-measure
    // everything, which used to make large pages quadratic.
    decided.add(root)
    enqueue(root)
    for (const el of root.querySelectorAll('*')) enqueue(el)
  }

  const sweepSoon = (): void => {
    if (disposed || timer !== undefined) return
    timer = window.setTimeout(() => {
      timer = undefined
      sweep()
    }, 300)
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes') {
        const target = record.target
        if (!(target instanceof Element)) continue
        // Our own stamps are not inputs: re-deciding on them would loop.
        if (record.attributeName?.startsWith('data-md-')) continue
        decided.delete(target)
        enqueue(target)
        sweepSoon()
        continue
      }
      for (const node of record.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue
        const el = node as Element
        enqueue(el)
        for (const child of el.querySelectorAll('*')) enqueue(child)
      }
    }
  })

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'data-state', 'data-phase', 'data-active'],
  })

  const onResize = (): void => {
    // Geometry-classified roles can change with the viewport.
    decided.clear?.()
    sweep()
  }

  window.addEventListener('resize', onResize, { passive: true })

  sweep()

  return {
    rescan(): void {
      for (const el of document.querySelectorAll(`[${ROLE_ATTRIBUTE}]`)) {
        const role = el.getAttribute(ROLE_ATTRIBUTE) as Role | null
        if (role !== null) clear(el, role)
      }
      // The memo must be dropped too: every element is already in `decided`, so
      // without this the sweep below enqueues nothing and a rescan is a no-op.
      decidedRef = new WeakSet<Element>()
      measured = 0
      handDressed = 0
      stamped = 0
      for (const key of Object.keys(byRole) as Role[]) byRole[key] = 0
      sweep()
    },
    stats(): CensusStats {
      return {
        measured,
        stamped,
        handDressed,
        pending: queue.length - cursor,
        byRole: { ...byRole },
      }
    },
    dispose(): void {
      disposed = true
      observer.disconnect()
      window.removeEventListener('resize', onResize)
      if (frame !== undefined) cancelAnimationFrame(frame)
      if (timer !== undefined) window.clearTimeout(timer)
      for (const el of document.querySelectorAll(`[${ROLE_ATTRIBUTE}], [${SPOT_ATTRIBUTE}], [${VEIL_ATTRIBUTE}]`)) {
        el.removeAttribute(ROLE_ATTRIBUTE)
        el.removeAttribute(SPOT_ATTRIBUTE)
        el.removeAttribute(VEIL_ATTRIBUTE)
      }
      queue = []
      cursor = 0
      queued.clear()
    },
  }
}
