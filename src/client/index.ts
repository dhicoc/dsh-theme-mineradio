/**
 * Mineradio client plugin body: the toggleable cinematic glass skin. Owns the
 * durable enable flag (localStorage), applies/retracts the theme layer through
 * {@link MineradioLayer}, and registers two settings surfaces:
 * - the master on/off card into the Plugins section (`settings.plugin.item`,
 *   same shape as the other plugin cards);
 * - every glass knob into the General section's Appearance row area
 *   (`settings.general.item`, right under 外观).
 * One click on the master switch returns the stock UI (every layer is an
 * effect, disposed on flip).
 */
import type { Context } from '@deepseek-ai/cordis'
import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the `settings.plugin.item` SlotMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
// Type-only: pulls the `settings.general.item` SlotMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { MineradioPluginCard, type MineradioPluginCardInjected } from './MineradioPluginCard.tsx'
import { MineradioAppearanceRow, type MineradioAppearanceRowInjected } from './MineradioAppearanceRow.tsx'
import { createMineradioRowStore, type MineradioSettingsPayload } from './settings-store.ts'
import { en, NS, zh } from './locales.ts'
import { MineradioLayer } from './theme-layer.ts'
import { runSurfaceAudit } from './surface-audit.ts'
// Side-effect imports: the theme-layer stylesheet (unloaded with the plugin)
// and the self-hosted font @font-face (no shell dependency).
import './mineradio.module.css'
import './fonts.module.css'

/** Required services: theme override stack plus the settings-card surfaces. */
export const inject = ['theme', 'slots', 'locale']

/**
 * Client plugin body.
 * @param ctx - client cordis context.
 */
export function apply(ctx: Context): void {
  // Dev-tool console API: `__mineradioAudit()` sweeps the live page for
  // un-adapted opaque surfaces (stamps gold outlines + copies a report),
  // `__mineradioAudit(false)` clears the stamps. Self-guarding: it warns
  // and no-ops while the theme layer is off.
  ;(window as unknown as Record<string, unknown>).__mineradioAudit = (clear?: boolean) => {
    if (clear === false) {
      for (const el of document.body.querySelectorAll('[data-dsh-aqua-unthemed]')) {
        el.removeAttribute('data-dsh-aqua-unthemed')
      }
      document.documentElement.removeAttribute('data-dsh-aqua-audit')
      return
    }
    return runSurfaceAudit()
  }

  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-mineradio: settings dictionaries')

  // The layer owns its lifecycle: enable flag, token stack, and CSS attribute
  // are all effects released on disable/dispose.
  const layer = new MineradioLayer(ctx)

  // Dev-tool console API for the automatic cover: `__mineradioCover()` reports
  // how many surfaces/bones the scanner stamped, `__mineradioCover(true)`
  // forces a fresh pass (after a host repaint the per-element memo missed).
  ;(window as unknown as Record<string, unknown>).__mineradioCover = (rescan?: boolean) => {
    const stats = rescan === true ? layer.coverRescan() : layer.coverStats()
    console.info(
      `[mineradio cover] ${stats.surfaces} face(s) dressed (${stats.spots} on spotlight), ` +
      `${stats.bones} ground slab(s) lifted, ${stats.measured} element(s) measured, ${stats.pending} queued`,
    )
    return stats
  }

  // Emergency switch: `__mineradioCoverOff()` drops every stamp the automatic
  // cover placed and stops it, leaving the rest of the theme alone. If a
  // suspicious plate disappears after running it, the cover painted it; if the
  // plate stays, something else does and the cover is innocent.
  ;(window as unknown as Record<string, unknown>).__mineradioCoverOff = () => {
    layer.coverOff()
    console.info('[mineradio cover] stopped, every cover stamp removed')
  }

  // Forensics: `__mineradioBlame()` walks the layers under the middle of the
  // viewport (or the point you pass) and reports whichever of them paints —
  // owner, paint, and whether the theme or the cover touched it. Needs no
  // DevTools selection, so it works with the panel closed.
  ;(window as unknown as Record<string, unknown>).__mineradioBlame = (x?: number, y?: number) => {
    const cx = x ?? Math.round(window.innerWidth / 2)
    const cy = y ?? Math.round(window.innerHeight / 2)
    const stack: Array<Record<string, unknown>> = []
    for (const el of document.elementsFromPoint(cx, cy)) {
      const style = getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      stack.push({
        tag: el.tagName.toLowerCase(),
        cls: el.className?.toString().slice(0, 64) ?? '',
        aqua: el
          .getAttributeNames()
          .filter((name) => name.startsWith('data-dsh'))
          .map((name) => `${name}=${el.getAttribute(name) ?? ''}`)
          .join(' '),
        area: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
        position: style.position,
        z: style.zIndex,
        bgColor: style.backgroundColor,
        bgImage: style.backgroundImage.slice(0, 80),
        shadow: style.boxShadow.slice(0, 80),
        backdrop: style.backdropFilter,
      })
    }
    console.table(stack)
    const report = JSON.stringify({ at: [cx, cy], stack }, null, 1)
    console.info(report)
    void navigator.clipboard?.writeText(report)
    return stack
  }

  // Two store mirrors of the same layer state: one for the Plugins card
  // (master switch) and one for the General section's Appearance row (knobs).
  const pluginStore = createMineradioRowStore()
  const appearanceStore = createMineradioRowStore()
  let pluginBound: BoundActions<typeof pluginStore> | undefined
  let appearanceBound: BoundActions<typeof appearanceStore> | undefined
  let revision = 0
  const payload = (): MineradioSettingsPayload => {
    const s = layer.getSettings()
    return {
      enabled: layer.getEnabled(),
      mode: s.mode,
      textStyle: s.textStyle,
      blur: s.blur,
      frost: s.frost,
      fluidHue: s.fluidHue,
      fluidDepth: s.fluidDepth,
      dispersionHue: s.dispersionHue,
      dispersionRefract: s.dispersionRefract,
      bgBrightness: s.bgBrightness,
      dark: layer.getDark(),
      background: s.background,
      wallpaper: s.wallpaper,
      autoTint: s.autoTint,
      whale: s.whale,
      critters: s.critters,
      mesh: s.mesh,
      starDensity: s.starDensity,
      spotlight: s.spotlight,
      press: s.press,
      audioReact: s.audioReact,
      wallpaperBlur: s.wallpaperBlur,
      wallpaperFrost: s.wallpaperFrost,
      wallpaperMask: s.wallpaperMask,
      wallpaperMaskBlur: s.wallpaperMaskBlur,
      wallpaperMaskOpacity: s.wallpaperMaskOpacity,
      videoBlur: s.videoBlur,
      videoBrightness: s.videoBrightness,
      perf: s.perf,
      rainbow: s.rainbow,
    }
  }
  const sync = (): void => {
    const next = payload()
    pluginBound?.sync(next, revision)
    appearanceBound?.sync(next, revision)
    revision += 1
  }
  // The Appearance switch flips the brightness knob's half-range; re-sync
  // both stores so the row re-renders with the new range.
  ctx.effect(() => ctx.on('theme/change', () => { sync() }), 'ui-mineradio: appearance scheme sync')

  const pluginInjected = (actions: BoundActions<typeof pluginStore>): MineradioPluginCardInjected => {
    pluginBound = actions
    // Re-sync from the layer so no flip is lost between registration and
    // first render (the store's revision guard drops stale duplicates).
    sync()
    return {
      setEnabled: (enabled) => {
        layer.setEnabled(enabled)
        sync()
      },
    }
  }
  const appearanceInjected = (actions: BoundActions<typeof appearanceStore>): MineradioAppearanceRowInjected => {
    appearanceBound = actions
    sync()
    return {
      applyScene: (scene) => {
        layer.applyScene(scene)
        sync()
      },
      setPerf: (perf) => {
        layer.setPerf(perf)
        sync()
      },
      setMode: (mode) => {
        layer.setMode(mode)
        sync()
      },
      setTextStyle: (textStyle) => {
        layer.setTextStyle(textStyle)
        sync()
      },
      setBlur: (blur) => {
        layer.setBlur(blur)
        sync()
      },
      setFrost: (frost) => {
        layer.setFrost(frost)
        sync()
      },
      setFluidHue: (fluidHue) => {
        layer.setFluidHue(fluidHue)
        sync()
      },
      setFluidDepth: (fluidDepth) => {
        layer.setFluidDepth(fluidDepth)
        sync()
      },
      setDispersionHue: (dispersionHue) => {
        layer.setDispersionHue(dispersionHue)
        sync()
      },
      setDispersionRefract: (dispersionRefract) => {
        layer.setDispersionRefract(dispersionRefract)
        sync()
      },
      setBgBrightness: (bgBrightness) => {
        layer.setBgBrightness(bgBrightness)
        sync()
      },
      setBackground: (background) => {
        layer.setBackground(background)
        sync()
      },
      setWallpaper: (wallpaper) => {
        layer.setWallpaper(wallpaper)
        sync()
      },
      setAutoTint: (autoTint) => {
        layer.setAutoTint(autoTint)
        sync()
      },
      setWhale: (whale) => {
        layer.setWhale(whale)
        sync()
      },
      setCritters: (critters) => {
        layer.setCritters(critters)
        sync()
      },
      setMesh: (mesh) => {
        layer.setMesh(mesh)
        sync()
      },
      setStarDensity: (starDensity) => {
        layer.setStarDensity(starDensity)
        sync()
      },
      setSpotlight: (spotlight) => {
        layer.setSpotlight(spotlight)
        sync()
      },
      setPress: (press) => {
        layer.setPress(press)
        sync()
      },
      setAudioReact: (audioReact) => {
        layer.setAudioReact(audioReact)
        sync()
      },
      setWallpaperBlur: (wallpaperBlur) => {
        layer.setWallpaperBlur(wallpaperBlur)
        sync()
      },
      setWallpaperFrost: (wallpaperFrost) => {
        layer.setWallpaperFrost(wallpaperFrost)
        sync()
      },
      setWallpaperMask: (wallpaperMask) => {
        layer.setWallpaperMask(wallpaperMask)
        sync()
      },
      setWallpaperMaskBlur: (wallpaperMaskBlur) => {
        layer.setWallpaperMaskBlur(wallpaperMaskBlur)
        sync()
      },
      setWallpaperMaskOpacity: (wallpaperMaskOpacity) => {
        layer.setWallpaperMaskOpacity(wallpaperMaskOpacity)
        sync()
      },
      setVideoBlur: (videoBlur) => {
        layer.setVideoBlur(videoBlur)
        sync()
      },
      setVideoBrightness: (videoBrightness) => {
        layer.setVideoBrightness(videoBrightness)
        sync()
      },
      authorizeVideo: () => {
        layer.authorizeVideo()
      },
    }
  }

  // Master switch tab in the Plugins section (0.2.0-rc.2: the plugin card
  // slot is a localized tab ledger — `settings.plugins.tab`; the 0.1.x
  // `settings.plugin.item` slot no longer exists). Label is the brand name
  // (locale-independent); the card itself carries the localized copy.
  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'mineradio',
    order: 20,
    label: 'Mineradio',
    store: pluginStore,
    locale: NS,
    inject: pluginInjected,
  }, MineradioPluginCard))

  // Glass knobs row in the General section, directly under Appearance (10).
  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'mineradio',
    order: 11,
    store: appearanceStore,
    locale: NS,
    inject: appearanceInjected,
  }, MineradioAppearanceRow))
}
