/* Page actions rendering: flags, loading, errors */

import { type GeoData } from '../lib/types.js'
import { SquareCanvas, storage } from './index.js'

async function setFlagIcon(tabId: number, path: string) {
  const square = new SquareCanvas()

  await square.drawUpscaled(path)
  await square.setIconFromCanvas(tabId)
}

async function setProgressIcon(tabId: number, domain: string, glyph: string) {
  const path = await storage.getDomainIcon(domain)
  const square = new SquareCanvas()

  await square.drawUpscaledWithGlyph(path, glyph)
  square.setIconFromCanvas(tabId)
}

const unreachable = (k: never) => {
  throw new Error(`Unreachable path reached with '${k}'`)
}

type PageAction = (
  | { kind: 'local' | 'loading' }
  | { kind: 'error'; error: string }
  | {
      kind: 'geo'
      data: Pick<GeoData, 'country_code' | 'country_name' | 'region' | 'city'>
    }
) & { domain: string }

function title(action: PageAction) {
  const { domain, kind } = action

  if (kind == 'local') return `${domain} is a local resource`
  if (kind == 'loading') return `Resolving ${domain} …`
  if (kind == 'error') return `Error: ${action.error}`

  if (kind == 'geo') {
    const { country_name, region, city } = action.data
    return [country_name, region, city].filter(Boolean).join(' → ')
  }

  return unreachable(kind)
}

export async function setPageAction(tabId: number, action: PageAction) {
  await chrome.action.setTitle({ tabId, title: title(action) })

  const { domain, kind } = action

  if (kind == 'geo') {
    const { country_code } = action.data
    const path = `/img/flags/${country_code.toLowerCase()}.png`

    await setFlagIcon(tabId, path)
    // there is no way to read current image data back from page action 😥
    // save icon path, so we can draw a glyph over it
    await storage.saveDomainIcon(domain, path)
  }

  if (kind == 'local') {
    const path = '/img/local_resource.png'

    await chrome.action.setIcon({ tabId, path })
    await storage.saveDomainIcon(domain, path)
  }

  if (kind == 'loading') await setProgressIcon(tabId, domain, '🔵')

  if (kind == 'error') await setProgressIcon(tabId, domain, '🔴')
}
