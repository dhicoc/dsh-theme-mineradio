/**
 * Runtime seam stamper.
 *
 * The Aqua stylesheet keys off stable data-* hooks (`data-dsh-frame`,
 * `data-dsh-sidebar-root`, `data-hero-headline`, …). In the monorepo those
 * hooks are authored into the base packages' source; for a self-contained
 * distribution (installed against a stock DSH) this module stamps them onto
 * the matching elements at runtime, so the stylesheet works with zero base
 * edits. Each selector uses only stable attributes already present in the
 * stock UI (`data-composer-card`, `data-conversation-composer-overlay`,
 * ARIA roles) or lightningcss-preserved class-name substrings.
 *
 * Stamps are idempotent and inert without the `data-dsh-aqua` root attribute
 * (the whole stylesheet is gated on it), so they are simply left in place when
 * the layer flips off — "off" still renders the exact stock UI.
 */

interface Seam {
  /** Attribute to stamp (bare name; value is always ''). */
  readonly attribute: string
  /** CSS selector for the element(s) to stamp. */
  readonly selector: string
  /** Stamp only the first (topmost) match, not every descendant match. */
  readonly first?: boolean
}

const SEAMS: readonly Seam[] = [
  // The layout frame: the sidebar column's direct parent.
  { attribute: 'data-dsh-frame', selector: ':has(> [class*="sidebarCol"])' },
  // The sidebar content root (topmost `root` under the column — settings
  // internals also carry a `root` class but sit deeper, so first match wins).
  { attribute: 'data-dsh-sidebar-root', selector: '[class*="sidebarCol"] [class*="root"]', first: true },
  // New-session button (the raised-surface seam).
  { attribute: 'data-dsh-surface', selector: 'button[class*="newSession"]' },
  // Trajectory view (the only composer-overlay view today).
  { attribute: 'data-dsh-trajectory', selector: '[data-conversation-composer-overlay]' },
  // Details panel (topmost `root` under the details column). 0.1.x names the
  // column `detailsCol`; 0.2.0-rc.2 replaced it with the rightbar track whose
  // column element carries the stable `data-rightbar-col` attribute — keep
  // both seams so the stamp resolves on either shell.
  { attribute: 'data-dsh-details', selector: '[class*="detailsCol"] [class*="root"]', first: true },
  { attribute: 'data-dsh-details', selector: '[data-rightbar-col] [class*="root"]', first: true },
  // Composer bar root: the composer card's direct parent.
  { attribute: 'data-dsh-inputbar', selector: ':has(> [data-composer-card])' },
  // Composer attach "+" button.
  { attribute: 'data-dsh-add', selector: '[data-composer-card] [class*="add"]' },
  // Session stats line under the composer (composer.dock slot).
  { attribute: 'data-dsh-stats', selector: '[data-slot="conversation.composer.dock"] [class*="root"]' },
  // Spotlight / hover-tilt panes: the floating-glass surfaces the cursor
  // glow and the geometric press target. The inputbar (composer + its
  // docked stats band) is ONE spot so the fused piece tilts and glows
  // together; the small + bead and chat bubbles stay out so the effect
  // reads as "the glass panes", not every surface.
  { attribute: 'data-dsh-aqua-spot', selector: 'header', first: true },
  { attribute: 'data-dsh-aqua-spot', selector: '[class*="sidebarCol"]', first: true },
  { attribute: 'data-dsh-aqua-spot', selector: '[data-dsh-inputbar]' },
  { attribute: 'data-dsh-aqua-spot', selector: '[data-dsh-trajectory]' },
  { attribute: 'data-dsh-aqua-spot', selector: '[data-dsh-surface]' },
  // The sidebar wordmark button (its badge plate gets the official pill).
  { attribute: 'data-dsh-wordmark', selector: '[class*="sidebarCol"] [class*="brand"]', first: true },
]

/**
 * Stamp the seams once, then inspect only changed subtrees as React remounts.
 * First-match seams retain document order, including removal of the first node.
 */
export function startSeamStamper(): () => void {
  const roots = new Set<Element>()
  const parents = new Set<Element>()
  const firstMatches = new Map<Seam, Element>()
  const invalidFirst = new Set<Seam>()
  const lamps = new Set<Element>()
  let frame: number | undefined
  let disposed = false

  const apply = (seam: Seam, el: Element): void => {
    if (!el.hasAttribute(seam.attribute)) el.setAttribute(seam.attribute, '')
    if (seam.attribute === 'data-dsh-inputbar') lamps.add(el)
  }

  const considerFirst = (seam: Seam, candidate: Element | null): void => {
    if (candidate === null) return
    const previous = firstMatches.get(seam)
    if (previous !== undefined && previous.isConnected &&
        !(candidate.compareDocumentPosition(previous) & Node.DOCUMENT_POSITION_FOLLOWING)) return
    firstMatches.set(seam, candidate)
    apply(seam, candidate)
  }

  const stampRoots = (initial = false): void => {
    // Preserve seam declaration order: inputbar/trajectory/surface stamps are
    // themselves the selectors of the later spotlight seams.
    for (const seam of SEAMS) {
      const previous = firstMatches.get(seam)
      if (seam.first && (initial || invalidFirst.has(seam) ||
          (previous !== undefined && (!previous.isConnected || !previous.matches(seam.selector))))) {
        firstMatches.delete(seam)
        const match = document.querySelector(seam.selector)
        if (match !== null) { firstMatches.set(seam, match); apply(seam, match) }
        continue
      }
      for (const parent of parents) {
        if (!parent.isConnected || !parent.matches(seam.selector)) continue
        if (seam.first) considerFirst(seam, parent)
        else apply(seam, parent)
      }
      for (const root of roots) {
        if (!root.isConnected) continue
        if (seam.first) {
          considerFirst(seam, root.matches(seam.selector) ? root : root.querySelector(seam.selector))
        } else {
          if (root.matches(seam.selector)) apply(seam, root)
          for (const el of root.querySelectorAll(seam.selector)) apply(seam, el)
        }
      }
    }
    for (const bar of lamps) {
      if (!bar.isConnected) continue
      const live = bar.querySelector('button[aria-label="停止生成"], button[aria-label="Stop generating"]') !== null
      if (bar.hasAttribute('data-dsh-on-air') !== live) bar.toggleAttribute('data-dsh-on-air', live)
    }
    roots.clear()
    parents.clear()
    invalidFirst.clear()
    lamps.clear()
  }

  const flush = (): void => {
    frame = undefined
    if (disposed) return
    // Ancestor/descendant records in one React commit need only one subtree scan.
    for (const root of roots) {
      let parent = root.parentElement
      while (parent !== null && !roots.has(parent)) parent = parent.parentElement
      if (parent !== null) roots.delete(root)
    }
    stampRoots()
  }

  roots.add(document.documentElement)
  stampRoots(true)

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      const target = record.target instanceof Element ? record.target : record.target.parentElement
      if (target === null) continue
      const bar = target.closest('[data-dsh-inputbar]')
      if (bar !== null) lamps.add(bar)
      if (record.type === 'attributes') {
        if (record.attributeName !== 'aria-label') {
          roots.add(target)
          if (target.parentElement !== null) parents.add(target.parentElement)
        }
        continue
      }
      let elementsChanged = false
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue
        roots.add(node)
        elementsChanged = true
      }
      for (const node of record.removedNodes) {
        if (!(node instanceof Element)) continue
        elementsChanged = true
        for (const [seam, first] of firstMatches) {
          if (node === first || node.contains(first)) invalidFirst.add(seam)
        }
      }
      // :has(> ...) seams can become true on the mutation target itself. Text
      // streaming affects none of these selectors, so it needs no seam sweep.
      if (elementsChanged) parents.add(target)
    }
    if (frame === undefined && (roots.size || parents.size || invalidFirst.size || lamps.size)) {
      frame = requestAnimationFrame(flush)
    }
  })
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'data-composer-card', 'data-conversation-composer-overlay', 'data-rightbar-col', 'data-slot', 'aria-label'],
  })
  return () => {
    disposed = true
    observer.disconnect()
    if (frame !== undefined) cancelAnimationFrame(frame)
    roots.clear()
    parents.clear()
    firstMatches.clear()
    invalidFirst.clear()
    lamps.clear()
  }
}
