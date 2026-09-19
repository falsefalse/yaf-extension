/* Page actions rendering: flags, loading, errors */

import type { GeoData } from '../lib/types'
import { DEFAULT_ICON, SquareCanvas, storage } from './index'

async function setIcon(
  tabId: number,
  domain: string | undefined,
  glyph: string,
  glyphSizePx?: number
) {
  const path = domain ? await storage.getDomainIcon(domain) : DEFAULT_ICON
  await new SquareCanvas().setIcon({ tabId, path, glyph, glyphSizePx })
}

const unreachable = (k: never) => {
  throw new Error(`Unreachable path reached with '${String(k)}'`)
}

type PageAction =
  | { kind: 'settings_page'; domain?: never }
  | ({ domain: string } & (
      | { kind: 'local'; is_tailscale?: boolean }
      | { kind: 'loading' }
      | { kind: 'error'; error: string }
      | {
          kind: 'geo'
          data: Pick<
            GeoData,
            'country_code' | 'country_name' | 'region' | 'city'
          >
        }
    ))

function title(action: PageAction) {
  const { domain, kind } = action

  if (kind == 'local')
    return action.is_tailscale
      ? `${domain} is a Tailscale node`
      : `${domain} is a local resource`

  if (kind == 'loading') return `Resolving ${domain} …`
  if (kind == 'error') return `Error: ${action.error}`

  if (kind == 'geo') {
    const { country_name, region, city } = action.data
    return [country_name, region, city].filter(Boolean).join(' → ')
  }

  return 'Internal browser page'
}

export async function setPageAction(tabId: number, action: PageAction) {
  await chrome.action.setTitle({ tabId, title: title(action) })

  const { domain, kind } = action

  if (kind == 'geo') {
    const { country_code } = action.data
    const path = `/img/flags/${country_code.toLowerCase()}.png`

    await new SquareCanvas().setIcon({ tabId, path })
    // there is no way to read current image data back from page action 😥
    // save icon path, so we can draw a glyph over it
    await storage.saveDomainIcon(domain, path)

    return
  }

  if (kind == 'local') {
    const path = action.is_tailscale
      ? '/img/tailscale.png'
      : '/img/local_resource.png'

    await chrome.action.setIcon({ tabId, path })
    await storage.saveDomainIcon(domain, path)

    return
  }

  if (kind == 'loading') return await setIcon(tabId, domain, '🔵')

  if (kind == 'error') return await setIcon(tabId, domain, '🔴')

  if (kind == 'settings_page') return await setIcon(tabId, undefined, '⚙', 64)

  return unreachable(kind)
}
