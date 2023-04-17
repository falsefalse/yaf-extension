import type { Data, DoHResponse } from './lib/types.js'

import config from './config.js'

/* domains and IPs */

function getDomain(url: string | undefined) {
  if (!url) return

  const { protocol, hostname } = new URL(url)
  if (!['http:', 'https:', 'ftp:'].includes(protocol)) return

  return hostname
}

function isLocal(ip: string | undefined): ip is string {
  if (!ip) return false

  if (ip == 'localhost') return true

  const octets = ip.split('.').map(o => parseInt(o, 10))
  if (octets.some(isNaN) || octets.length != 4) return false

  // 0.0.0.0
  if (octets.every(o => o === 0)) return true

  const [first = 0, second = 0] = octets
  // 127.0.0.1 - 127.255.255.255
  if (first === 127) return true
  // 10.0.0.0 - 10.255.255.255
  if (first === 10) return true
  // 172.16.0.0 - 172.31.255.255
  if (first === 172 && second >= 16 && second <= 31) return true
  // 192.168.0.0 - 192.168.255.255
  if (first === 192 && second === 168) return true

  return false
}

/* local storage */

class Storage {
  private async set(key: string, value: unknown) {
    const data = { [key]: value }
    try {
      await chrome.storage.local.set(data)
    } catch (error) {
      await chrome.storage.local.clear()
      await chrome.storage.local.set(data)
    }
  }

  private async get(key: string) {
    return ((await chrome.storage.local.get(key)) || {})[key]
  }

  async saveDomain(domain: string, value: Data) {
    return await this.set(domain, value)
  }
  async getDomain(domain: string): Promise<Data | undefined> {
    return await this.get(domain)
  }

  async saveDomainIcon(domain: string, path: string) {
    const data = await this.get(domain)
    if (data) {
      await this.set(domain, { ...data, icon: path })
    }
  }
  async getDomainIcon(domain: string) {
    const data = await this.get(domain)

    return data?.icon || DEFAULT_ICON
  }
}

const storage = new Storage()

/* Canvas shenanigans 🎨 */

const isFirefox = () => 'dns' in chrome

const DEFAULT_ICON = '/img/icon/32.png'

export interface SquareCanvas {
  size: number
  ctx: OffscreenCanvasRenderingContext2D
}

export class SquareCanvas {
  // local_resource.png is 64x64, globe is 32x32, flags 16px wide
  // so upscale everything to 64px
  constructor(size = 64) {
    const ctx = new OffscreenCanvas(size, size).getContext('2d', {
      willReadFrequently: true
    })
    if (!ctx) throw new Error('Failed to get 2d canvas context')

    this.ctx = ctx
    this.size = size

    this.ctx.clearRect(0, 0, size, size)
  }

  private center(whole: number, part: number) {
    return Math.round(Math.max(whole - part, 0) / 2)
  }

  async drawUpscaled(path: string) {
    const { size, ctx, center } = this

    // read image and its dimensions
    const imgBlob = await (await fetch(path)).blob()
    const original = await createImageBitmap(imgBlob)
    const { width, height } = original
    original.close()

    // give all flags scale factor 4
    // pretend all flags are boxed in 16px wide box
    // they all are, apart from 9 x 11 Nepal 🇳🇵
    const scale = path.includes('/flags/') ? 4 : size / width

    // upscale without smoothing
    const upscaled = await createImageBitmap(imgBlob, {
      resizeQuality: 'pixelated',
      resizeWidth: width * scale,
      resizeHeight: height * scale
    })

    ctx.drawImage(
      upscaled,
      center(size, upscaled.width),
      center(size, upscaled.height)
    )
    upscaled.close()
  }

  async drawUpscaledWithGlyph(path: string, glyph: string) {
    await this.drawUpscaled(path)
    this.addGlyph(glyph)
  }
  async drawUpscaledWithBlur(path: string) {
    this.blur()
    await this.drawUpscaled(path)
  }

  private blur(radius = 2) {
    this.ctx.filter = `blur(${radius}px)`
  }

  private addGlyph(glyph: string) {
    const { size, ctx } = this

    ctx.font = '24px serif'
    ctx.fillStyle = `rgb(0, 0, 0, 1)`

    // eslint-disable-next-line prefer-const
    let { width: textWidth, actualBoundingBoxDescent: textDescent } =
      ctx.measureText(glyph)

    // firefox needs something to hang down, otherwise emoji gets cut off
    if (isFirefox()) {
      glyph += ' q'
      textDescent = ctx.measureText(glyph).actualBoundingBoxDescent
    }

    ctx.fillText(glyph, size - textWidth, size - textDescent)
  }

  async setIconFromCanvas(tabId: number) {
    const { size, ctx } = this

    await chrome.action.setIcon({
      tabId,
      imageData: {
        [size.toString()]: ctx.getImageData(0, 0, size, size)
      }
    })
  }
}

/* Page actions rendering: flags, loading, errors */

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

async function setPageAction(tabId: number, domain: string, action: Actions) {
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

    const flagPng = `${country_code.toLowerCase()}.png`
    const path = `/img/flags/${flagPng}`

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

/* Google DNS over HTTPS */

async function resolve(domain: string) {
  if (isFirefox()) {
    try {
      const {
        addresses: [ip]
      } = await browser.dns.resolve(domain, ['disable_ipv6'])
      return ip
    } catch (e) {
      // continue if firefox couldn't resolve domain
    }
  }

  const url = new URL(config.dohApiUrl)
  url.searchParams.set('type', '1')
  url.searchParams.set('name', domain)

  let response, data
  try {
    response = await fetch(url.toString())
    data = (await response.json()) as DoHResponse | undefined
  } catch (error) {
    return
  }

  if (!response.ok || !data || !('Status' in data)) return

  const { Status: status, Answer: answer } = data

  if (status !== 0 || !answer) return

  return answer.find(({ type }) => type == 1)?.data
}

export { getDomain, isLocal, storage, resolve, setPageAction }
