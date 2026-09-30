/**
 * Surface audit — the adaptation loop, closed.
 *
 * Once the layer has mounted, the runtime cover (surface-cover.ts) has already
 * dressed every face it can reach. What this sweep reports is therefore the
 * residue: faces that paint something but carry no cover stamp — i.e. the ones
 * the cover deliberately skipped (blacklist) or could not reach. It shares the
 * cover's signature verbatim (SURFACE_POLICY), so the report and the cover can
 * never disagree about what a "face" is.
 *
 * Each hit is stamped `data-dsh-aqua-unthemed` (gold dashed outline while
 * `data-dsh-aqua-audit` sits on <html>) and grouped by its CSS-module word
 * root into a report that maps 1:1 onto new sweep roots or blacklist entries.
 * Dev-tool console API, no settings surface:
 *
 *   __mineradioAudit()        — scan, stamp, report (copies to clipboard)
 *   __mineradioAudit(false)   — clear stamps
 */
import { COVER_SURFACE_ATTRIBUTE, COVER_BONE_ATTRIBUTE, COVER_VEIL_ATTRIBUTE, paintedAlpha, SURFACE_POLICY } from './surface-cover.ts'

/** The theme attribute the whole layer is gated on. */
const AQUA = 'data-dsh-aqua'
/** Stamp for flagged elements; outlined under the audit attribute. */
const STAMP = 'data-dsh-aqua-unthemed'
/** Audit mode attribute on <html>; toggles the outline stylesheet. */
const MODE = 'data-dsh-aqua-audit'
/** Faces the cover already dressed — never reported. */
const COVERED_SELECTOR = `[${COVER_SURFACE_ATTRIBUTE}], [${COVER_BONE_ATTRIBUTE}], [${COVER_VEIL_ATTRIBUTE}]`

/** Elements that never count as un-adapted slabs. */
const SKIP_SELECTOR = [
  '[data-dsh-aqua-wallpaper]', '[data-dsh-aqua-ambient]', '[data-dsh-aqua-fade]',
  'img', 'video', 'canvas', 'svg', 'picture', 'iframe',
  // readability surfaces that legitimately stay solid:
  'pre', 'code', '.xterm',
  "[class*='code']", "[class*='Code']",
  "[class*='terminal']", "[class*='Terminal']",
  "[class*='markdown']", "[class*='Markdown']",
  "[class*='highlight']", "[class*='Highlight']",
  // the theme's own mounted surfaces:
  "[class*='mineradio']", "[class*='Mineradio']", "[class*='fonts_']",
].join(', ')

/** rAF slice size — keep the audit responsive on big trees. */
const SLICE = 400

interface Finding {
  /** Times this word root was seen. */
  count: number
  /** One concrete path-ish sample for the report. */
  sample: string
  /** The computed opaque fill, for eyeballing intent. */
  bg: string
}

/**
 * CSS-module class names hash their build prefix (`BynINW_centerCol`) but
 * keep the semantic tail stable — the word root is the audit's grouping
 * unit and the sweep's matching unit, deliberately the same vocabulary.
 * @param el - flagged element.
 * @returns the word root, or a placeholder for classless elements.
 */
function wordRoot(el: Element): string {
  const first = (el.className || '').split(/\s+/)[0] || ''
  const tail = first.split('_').pop()
  return tail && tail.length > 0 ? tail : '(no class)'
}

/**
 * Parse the alpha out of a computed background-color — the cover's own
 * helper, re-exported here so the two never diverge.
 * @param value - e.g. `rgb(8, 9, 11)` or `rgba(8, 9, 11, 0.55)`.
 * @returns 1 for `rgb()` forms (fully opaque), the parsed alpha otherwise.
 */
const alphaOf = paintedAlpha

/**
 * Run one audit pass: sweep, stamp, report.
 * @returns a disposer that clears the stamps and the audit attribute.
 */
export function runSurfaceAudit(): () => void {
  if (!document.documentElement.hasAttribute(AQUA)) {
    console.warn('[mineradio audit] the theme layer is off — nothing to audit.')
    return () => undefined
  }

  document.documentElement.setAttribute(MODE, '')
  const elements = Array.from(document.body.querySelectorAll('*'))
  const findings: Record<string, Finding> = {}
  let cursor = 0

  const step = (): void => {
    const end = Math.min(cursor + SLICE, elements.length)
    for (; cursor < end; cursor += 1) {
      const el = elements[cursor]
      // Skip the document elements by identity only. `#root` (or `body`) must
      // never enter the ancestor blacklist: the entire app mounts inside them,
      // and `closest()` would then exempt every surface on the page — the
      // audit would report full coverage while opaque slabs are on screen.
      if (el === document.body || el === document.documentElement) continue
      if (el.closest(SKIP_SELECTOR) !== null) continue
      if (el.hasAttribute(STAMP)) continue
      // Already dressed by the runtime cover — not residue.
      if (el.matches(COVERED_SELECTOR)) continue
      if (el.hasAttribute('data-dsh-aqua-cover-ignore')) continue
      const rect = el.getBoundingClientRect()
      if (rect.width < SURFACE_POLICY.minWidth || rect.height < SURFACE_POLICY.minHeight) continue
      if (rect.width * rect.height < SURFACE_POLICY.minArea) continue
      const style = getComputedStyle(el)
      const bg = style.backgroundColor
      if (alphaOf(bg) < SURFACE_POLICY.paintAlpha && style.backgroundImage === 'none') continue
      el.setAttribute(STAMP, '')
      const root = wordRoot(el)
      const finding = findings[root] ?? (findings[root] = { count: 0, sample: '', bg: '' })
      finding.count += 1
      if (finding.sample === '') {
        const cls = (el.className || '').split(/\s+/)[0]
        finding.sample = `${el.tagName.toLowerCase()}${cls === '' ? '' : `.${cls}`}`
        finding.bg = bg
      }
    }
    if (cursor < elements.length) {
      requestAnimationFrame(step)
      return
    }
    report(findings)
  }

  requestAnimationFrame(step)

  return () => {
    for (const el of document.body.querySelectorAll(`[${STAMP}]`)) el.removeAttribute(STAMP)
    document.documentElement.removeAttribute(MODE)
  }
}

/**
 * Print and copy the grouped report.
 * @param findings - grouped word-root findings.
 */
function report(findings: Record<string, Finding>): void {
  const entries = Object.entries(findings).sort((a, b) => b[1].count - a[1].count)
  if (entries.length === 0) {
    console.info('[mineradio audit] no un-adapted opaque surfaces — the sweep has full coverage.')
    return
  }
  console.group(`[mineradio audit] ${entries.length} un-adapted word root(s) — gold outlines are live on the page`)
  console.table(entries.map(([root, f]) => ({ wordRoot: root, count: f.count, background: f.bg, sample: f.sample })))
  console.info('Next step: add each root to the L0/L1 sweep (or the blacklist) in mineradio.module.css — or nothing at all: the L1 glass already dresses them.')
  console.groupEnd()
  const text = entries
    .map(([root, f]) => `${root}\t×${f.count}\t${f.bg}\t${f.sample}`)
    .join('\n')
  void navigator.clipboard?.writeText(text).then(
    () => console.info('[mineradio audit] report copied to clipboard (tab-separated).'),
    () => console.info('[mineradio audit] clipboard unavailable — copy from the table above.'),
  ).catch(() => undefined)
}
