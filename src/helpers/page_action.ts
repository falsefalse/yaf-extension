/* Page actions rendering: flags, loading, errors */

import { SquareCanvas } from './canvas.js'
import { DEFAULT_ICON, isFirefox } from './misc.js'
import { storage } from './storage.js'

async function setFlagIcon(tabId: number, domain: string, path: string) {
  const square = new SquareCanvas()

  await square.drawUpscaled(path)
  await square.setIconFromCanvas(tabId)

  // there is no way to read current image data back from page action 😥
  // save icon path, so we can draw a glyph over it
  await storage.saveDomainIcon(domain, path)
}

async function setProgressIcon(tabId: number, domain: string, glyph: string) {
  const path = await storage.getDomainIcon(domain)
  const square = new SquareCanvas()

  // Firefox can not OffscreenCanvasRenderingContext2D.filter
  // https://wpt.fyi/results/html/canvas/offscreen/manual/filter/offscreencanvas.filter.html
  // so fall back to glyphs instead
  if (path == DEFAULT_ICON || isFirefox()) {
    await square.drawUpscaledWithGlyph(path, glyph)
  } else {
    await square.drawUpscaledWithBlur(path)
  }

  square.setIconFromCanvas(tabId)
}

type Actions =
  | { kind: 'local' | 'loading' }
  | { kind: 'error'; title: string }
  | { kind: 'geo'; country_code: string; title: string }

export async function setPageAction(
  tabId: number,
  domain: string,
  action: Actions
) {
  const { kind } = action

  if (kind == 'local') {
    const title = `${domain} is a local resource`
    await chrome.action.setTitle({ tabId, title })

    const path = '/img/local_resource.png'
    await chrome.action.setIcon({ tabId, path })

    // save icon path, so we can draw a glyph over it
    await storage.saveDomainIcon(domain, path)
  }

  if (kind == 'geo') {
    const { country_code, title } = action
    await chrome.action.setTitle({ tabId, title })

    const path = `/img/flags/${country_code.toLowerCase()}.png`

    await setFlagIcon(tabId, domain, path)
  }

  if (kind == 'loading') {
    const title = `Resolving ${domain} …`
    await chrome.action.setTitle({ tabId, title })

    await setProgressIcon(tabId, domain, '🔵')
  }

  if (kind == 'error') {
    const { title } = action
    await chrome.action.setTitle({ tabId, title })

    await setProgressIcon(tabId, domain, '🔴')
  }
}
