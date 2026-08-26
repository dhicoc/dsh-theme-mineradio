/**
 * Station dial — every workspace is its own radio station.
 *
 * The sidebar's workspace rows (`.projectRow`) name the station. Each name
 * maps to a stable hue offset from a curated set of warm-adjacent stops,
 * remembered in localStorage; switching workspaces glides the fluid, glow
 * and dispersion tints there over ~2 seconds — like tuning a radio dial.
 * The brand row carries a tiny frequency window (`FM 044`) that flickers
 * while tuning. No settings knob: this is the radio being a radio.
 *
 * Resolution walks the flat ARIA tree: sessions are `.sessionRow` siblings
 * that follow their workspace's `.projectRow`, so "the nearest projectRow
 * at-or-before the selected session" names the station. Hero phase (no
 * selection) keeps whatever was tuned last.
 */

const STORAGE_KEY = 'dsh.ui-mineradio.stations'
const TUNER_SELECTOR = '[data-dsh-wordmark]'
const TUNER_ATTR = 'data-dsh-station-tuner'
const TUNING_ATTR = 'data-dsh-tuning'

/** Curated dial stops (offsets from the user's hue). Warm-adjacent only —
 *  champagne, gold, ember, rose, mint, teal. No blues, no purples: the
 *  brand stays a warm room even when every workspace sounds different. */
const DIAL_STOPS = [0, 24, -36, -62, 122, 150] as const

/** The base hue of the house frequency (settings.fluidHue default). */
const BASE_HUE = 44

/** Tune glide duration (ms). Slow enough to read as a dial, not a glitch. */
const TUNE_MS = 2200

interface StoredStations {
  [name: string]: number
}

/** FNV-1a — deterministic per name so a fresh install lands on the same stop. */
function hashName(name: string): number {
  let h = 2166136261
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function readStored(): StoredStations {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return {}
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return {}
    const out: StoredStations = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

function writeStored(stored: StoredStations): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch {
    /* private mode etc. — the hash fallback still works without memory */
  }
}

/** The offset for a station name: remembered, else hashed onto a curated
 *  stop and remembered from now on. */
function offsetFor(name: string): number {
  const stored = readStored()
  const known = stored[name]
  if (typeof known === 'number') return known
  const next = DIAL_STOPS[hashName(name) % DIAL_STOPS.length]
  stored[name] = next
  writeStored(stored)
  return next
}

/** The station name: nearest `.projectRow` at-or-before the selected session. */
export function resolveStationName(): string | null {
  const rows = Array.from(document.querySelectorAll("[role='treeitem']"))
  const selIdx = rows.findIndex((r) => r.getAttribute('aria-selected') === 'true')
  if (selIdx < 0) return null
  for (let i = selIdx; i >= 0; i--) {
    const row = rows[i]
    if (!/projectRow/.test(String(row.className))) continue
    const text = row.querySelector("[class*='projectText']")?.textContent?.trim()
    return text !== undefined && text !== '' ? text : null
  }
  return null
}

/** `FM 166` style label for the current effective hue. */
function freqLabel(offset: number): string {
  const freq = ((BASE_HUE + offset) % 360 + 360) % 360
  return `FM ${String(Math.round(freq)).padStart(3, '0')}`
}

const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/**
 * Watch the sidebar and retune when the station changes.
 * @param onOffset called with the interpolated offset each frame of a tune
 *   (and once at boot/settle), so the layer can repaint fluid + accents.
 * @returns a disposer that disconnects the observer and cancels any glide.
 */
export function startStationDial(onOffset: (offset: number) => void): () => void {
  let current = 0
  let station: string | null = null
  let primed = false
  let raf = 0

  const tuner = (): HTMLElement | null => document.querySelector<HTMLElement>(TUNER_SELECTOR)

  /** Ensure the brand-row frequency window exists and shows `label`. */
  const paintTuner = (label: string, tuning: boolean): void => {
    const host = tuner()
    if (host === null) return
    let el = host.querySelector<HTMLElement>(`[${TUNER_ATTR}]`)
    if (el === null) {
      el = document.createElement('span')
      el.setAttribute(TUNER_ATTR, '')
      el.setAttribute('aria-hidden', 'true')
      host.appendChild(el)
    }
    if (el.textContent !== label) el.textContent = label
    el.toggleAttribute(TUNING_ATTR, tuning)
  }

  const settle = (offset: number): void => {
    current = offset
    onOffset(offset)
  }

  const retune = (name: string): void => {
    const target = offsetFor(name)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || TUNE_MS === 0) {
      paintTuner(freqLabel(target), false)
      settle(target)
      return
    }
    cancelAnimationFrame(raf)
    const from = current
    const delta = target - from
    if (delta === 0) {
      paintTuner(freqLabel(target), false)
      return
    }
    // Short hops still sweep visibly; wrap-around takes the short way round.
    const wrapped = delta > 180 ? delta - 360 : delta < -180 ? delta + 360 : delta
    let start = 0
    paintTuner(freqLabel(from), true)
    const tick = (now: number): void => {
      raf = requestAnimationFrame(tick)
      if (start === 0) { start = now; return }
      const t = Math.min(1, (now - start) / TUNE_MS)
      const k = easeInOutCubic(t)
      const next = from + wrapped * k
      paintTuner(freqLabel(next), true)
      settle(next)
      if (t >= 1) {
        cancelAnimationFrame(raf)
        raf = 0
        paintTuner(freqLabel(target), false)
        settle(target)
      }
    }
    raf = requestAnimationFrame(tick)
  }

  const scan = (): void => {
    paintTuner(freqLabel(current), false)
    const name = resolveStationName()
    if (name === null || name === station) return
    station = name
    // First tune after boot lands directly — a page load should not sound
    // like a sweep; gliding is for changing stations while listening.
    if (!primed) {
      primed = true
      paintTuner(freqLabel(offsetFor(name)), false)
      settle(offsetFor(name))
      return
    }
    retune(name)
  }

  scan()
  const observer = new MutationObserver(() => { scan() })
  observer.observe(document.documentElement, { childList: true, subtree: true })

  return () => {
    observer.disconnect()
    cancelAnimationFrame(raf)
    raf = 0
    document.querySelector(`[${TUNER_ATTR}]`)?.remove()
  }
}
