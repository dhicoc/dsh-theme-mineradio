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
export const SPOT_ATTR = 'data-dsh-aqua-spot'

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
export const ROLE_SPOT_ATTR = 'data-md-spot'

/** Attribute on the injected glow overlay div. */
export const GLOW_ATTR = 'data-dsh-aqua-glow'

/** Marker set on a pane while the pointer is inside it. */
export const ON_ATTR = 'data-spot-on'

/** Selector matching every stamped pane, from either marker. */
export const SPOT_SELECTOR = `[${SPOT_ATTR}], [${ROLE_SPOT_ATTR}]`

/** Nearest stamped pane from an event target (null when outside all panes). */
export function closestSpot(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>(SPOT_SELECTOR) : null
}

/** Every stamped pane in document order. */
export function spotElements(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(SPOT_SELECTOR))
}

/**
 * The visible glass region of a pane (viewport rect). The fused
 * composer+stats spot is the wider invisible inputbar wrapper — its glass is
 * the union of the composer card and the docked stats band, so the wrapper's
 * side gutters stay outside every effect.
 */
export function visualRect(spot: HTMLElement): DOMRect {
  const questionCard = spot.querySelector<HTMLElement>('[data-question-key] section')
    ?? spot.querySelector<HTMLElement>('[data-question-key]')
  if (questionCard !== null) {
    return questionCard.getBoundingClientRect()
  }
  if (spot.querySelector('[data-composer-card]') !== null) {
    const card = spot.querySelector<HTMLElement>('[data-composer-card]')!
    const r0 = card.getBoundingClientRect()
    const stats = spot.querySelector<HTMLElement>('[data-dsh-stats]')
    if (stats === null) return r0
    const r1 = stats.getBoundingClientRect()
    const left = Math.min(r0.left, r1.left)
    const top = Math.min(r0.top, r1.top)
    return new DOMRect(left, top, Math.max(r0.right, r1.right) - left, Math.max(r0.bottom, r1.bottom) - top)
  }
  return spot.getBoundingClientRect()
}

/** Is the pointer over the visible glass of the pane? */
export function inside(visual: DOMRect, clientX: number, clientY: number): boolean {
  return clientX >= visual.left && clientX <= visual.right
    && clientY >= visual.top && clientY <= visual.bottom
}

/** Border-box origin in untransformed document layout space. Offset parents
 * contribute their borders; scroll containers need not be offset parents. */
function layoutOrigin(el: HTMLElement): { x: number; y: number } {
  let x = 0
  let y = 0
  for (let node: HTMLElement | null = el; node !== null;) {
    x += node.offsetLeft
    y += node.offsetTop
    const parent = node.offsetParent as HTMLElement | null
    if (parent !== null) {
      x += parent.clientLeft
      y += parent.clientTop
    }
    node = parent
  }
  for (let parent = el.parentElement; parent !== null; parent = parent.parentElement) {
    if (parent === document.scrollingElement) continue
    x -= parent.scrollLeft
    y -= parent.scrollTop
  }
  return { x, y }
}

/** Absolute offsets use the actual containing block's scrolling padding box.
 * A display:contents spot has no box and never appears in an offset chain. */
function localTopLeft(el: HTMLElement, containingBlock: HTMLElement | null): { x: number; y: number } {
  const point = layoutOrigin(el)
  if (containingBlock === null) return point
  const origin = layoutOrigin(containingBlock)
  return {
    x: point.x - origin.x - containingBlock.clientLeft + containingBlock.scrollLeft,
    y: point.y - origin.y - containingBlock.clientTop + containingBlock.scrollTop,
  }
}

/**
 * The visible glass region in a containing block's scrolling padding space
 * (untransformed — safe to measure while tilted). Pass the glow's actual
 * offsetParent for a boxless owner; null denotes the initial containing block.
 * The fused composer+stats spot uses the union of card and stats border boxes.
 */
export function glassLocalRect(spot: HTMLElement, containingBlock: HTMLElement | null = spot): { left: number; top: number; width: number; height: number } {
  const questionCard = spot.querySelector<HTMLElement>('[data-question-key] section')
    ?? spot.querySelector<HTMLElement>('[data-question-key]')
  if (questionCard !== null) {
    const qPos = localTopLeft(questionCard, containingBlock)
    return { left: qPos.x, top: qPos.y, width: questionCard.offsetWidth, height: questionCard.offsetHeight }
  }
  const card = spot.querySelector<HTMLElement>('[data-composer-card]')
  if (card === null) {
    const pos = localTopLeft(spot, containingBlock)
    return { left: pos.x, top: pos.y, width: spot.offsetWidth, height: spot.offsetHeight }
  }
  const cardPos = localTopLeft(card, containingBlock)
  let left = cardPos.x
  let top = cardPos.y
  let right = left + card.offsetWidth
  let bottom = top + card.offsetHeight
  const stats = spot.querySelector<HTMLElement>('[data-dsh-stats]')
  if (stats !== null) {
    const statsPos = localTopLeft(stats, containingBlock)
    left = Math.min(left, statsPos.x)
    top = Math.min(top, statsPos.y)
    right = Math.max(right, statsPos.x + stats.offsetWidth)
    bottom = Math.max(bottom, statsPos.y + stats.offsetHeight)
  }
  return { left, top, width: right - left, height: bottom - top }
}

/** Ensure the pane carries exactly one glow overlay div. */
export function ensureGlow(spot: HTMLElement): HTMLElement {
  let glow = spot.querySelector<HTMLElement>(`:scope > [${GLOW_ATTR}]`)
  if (glow === null) {
    glow = document.createElement('div')
    glow.setAttribute(GLOW_ATTR, '')
    glow.setAttribute('aria-hidden', 'true')
    // The logical spot may be display:contents. Until measured, inset:0
    // would stretch across a different ancestor's entire padding box.
    glow.style.width = '0px'
    glow.style.height = '0px'
    spot.appendChild(glow)
  }
  return glow
}

/**
 * One shared observer + resize feed: keeps the glow divs glued to the panes
 * through React re-renders and notifies the caller of DOM/layout changes
 * (the caller coalesces the callbacks).
 * @returns a disposer that removes every injected glow div.
 */
export function startOverlayKeeper(onChange: () => void): () => void {
  const spots = new Set<HTMLElement>()
  const roots = new Set<Element>()
  const repair = new Set<HTMLElement>()
  let removed = false
  let raf = 0
  const collect = (root: Element): void => {
    if (root.matches(SPOT_SELECTOR)) repair.add(root as HTMLElement)
    for (const spot of root.querySelectorAll<HTMLElement>(SPOT_SELECTOR)) repair.add(spot)
  }
  const flush = (): void => {
    raf = 0
    for (const root of roots) if (root.isConnected) collect(root)
    roots.clear()
    if (removed) {
      for (const spot of spots) if (!spot.isConnected) spots.delete(spot)
      removed = false
    }
    for (const spot of repair) {
      if (!spot.isConnected) continue
      if (spot.matches(SPOT_SELECTOR)) {
        spots.add(spot)
        ensureGlow(spot)
      } else {
        spots.delete(spot)
        spot.querySelector<HTMLElement>(`:scope > [${GLOW_ATTR}]`)?.remove()
      }
    }
    repair.clear()
    onChange()
  }
  const schedule = (): void => {
    if (raf === 0) raf = requestAnimationFrame(flush)
  }
  const addRoot = (root: Element): void => {
    for (const pending of roots) {
      if (pending.contains(root)) return
      if (root.contains(pending)) roots.delete(pending)
    }
    roots.add(root)
  }
  // The only whole-document discovery. Subsequent work is limited to added
  // subtrees and the closest affected owner, once per animation frame.
  collect(document.documentElement)
  flush()
  const observer = new MutationObserver(records => {
    let changed = false
    for (const record of records) {
      const target = record.target instanceof Element ? record.target : record.target.parentElement
      if (target === null || target.closest(`[${GLOW_ATTR}]`) !== null) continue
      if (record.type === 'attributes') {
        repair.add(target as HTMLElement)
        changed = true
        continue
      }
      const nodes = [...record.addedNodes, ...record.removedNodes]
      // Our overlay attachments/removals are already accounted for. React
      // removing a glow still queues its owner for repair below.
      const onlyGlow = nodes.length > 0 && nodes.every(node => node instanceof Element && node.hasAttribute(GLOW_ATTR))
      if (onlyGlow && (record.removedNodes.length === 0 || !target.matches(SPOT_SELECTOR))) continue
      const owner = closestSpot(target)
      if (owner !== null) repair.add(owner)
      for (const node of record.addedNodes) {
        if (node instanceof Element && !node.hasAttribute(GLOW_ATTR)) addRoot(node)
      }
      if (Array.from(record.removedNodes).some(node => node instanceof Element && !node.hasAttribute(GLOW_ATTR))) removed = true
      changed = true
    }
    if (changed) schedule()
  })
  observer.observe(document.documentElement, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: [SPOT_ATTR, ROLE_SPOT_ATTR],
  })
  window.addEventListener('resize', schedule, { passive: true })
  return () => {
    observer.disconnect()
    window.removeEventListener('resize', schedule)
    if (raf !== 0) cancelAnimationFrame(raf)
    for (const spot of spots) spot.querySelector<HTMLElement>(`:scope > [${GLOW_ATTR}]`)?.remove()
    spots.clear()
    roots.clear()
    repair.clear()
  }
}
