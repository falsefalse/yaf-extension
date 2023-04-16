import type { Data, DoHResponse } from './lib/types.js'

import config from './config.js'

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

const storage = {
  set: async (key: string, value: unknown) => {
    const data = { [key]: value }
    try {
      await chrome.storage.local.set(data)
    } catch (error) {
      await chrome.storage.local.clear()
      await chrome.storage.local.set(data)
    }
  },
  get: async (key: string) =>
    ((await chrome.storage.local.get(key)) || {})[key],

  getDomain: async (domain: string): Promise<Data | undefined> =>
    await storage.get(domain),

  setDomainIcon: async (domain: string, path: string) => {
    const data = await storage.get(domain)
    if (data) {
      await storage.set(domain, { ...data, icon: path })
    }
  },
  getDomainIcon: async (domain: string) => {
    const data: Record<string, string> = await storage.get(domain)

    return data?.icon || DEFAULT_ICON
  }
}

const isFirefox = () => 'dns' in chrome

/* Canvas shenanigans */

const DEFAULT_ICON = '/img/icon/32.png'

function getCtx(size = 64): [OffscreenCanvasRenderingContext2D, number] {
  const ctx = new OffscreenCanvas(size, size).getContext('2d', {
    willReadFrequently: true
  })

  if (!ctx) throw new Error('Failed to get 2d canvas context')

  ctx.clearRect(0, 0, size, size)

  return [ctx, size]
}

const center = (whole: number, part: number) =>
  Math.round(Math.max(whole - part, 0) / 2)

/* upscale icon by width */
async function drawUpscaled(
  ctx: OffscreenCanvasRenderingContext2D,
  path: string
) {
  // read image and its dimensions
  const imgBlob = await (await fetch(path)).blob()
  const original = await createImageBitmap(imgBlob)
  const { width, height } = original
  original.close()

  const size = ctx.canvas.width
  // give all flags scale factor 4
  // pretend all flags are boxed in 16px wide box
  // they all are apart from 16 x 9 Nepal 🇳🇵
  const scale = path.includes('/flags/') ? 4 : size / width

  // upscale without smoothing
  const upscaled = await createImageBitmap(imgBlob, {
    resizeQuality: 'pixelated',
    resizeWidth: width * scale,
    resizeHeight: height * scale
  })

  // draw bitmap on canvas, centering it
  ctx.drawImage(
    upscaled,
    center(size, upscaled.width),
    center(size, upscaled.height)
  )
  upscaled.close()
}

function addGlyph(ctx: OffscreenCanvasRenderingContext2D, glyph: string) {
  const size = ctx.canvas.width

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

async function setFlagIcon(tabId: number, domain: string, path: string) {
  const [ctx, size] = getCtx()

  await drawUpscaled(ctx, path)

  await chrome.action.setIcon({
    tabId,
    imageData: {
      [size.toString()]: ctx.getImageData(0, 0, size, size)
    }
  })

  // store icon path for current domain, setProgressIcon uses it
  // there is no way to read image data back from page action :/
  await storage.setDomainIcon(domain, path)
}

/* Render action progress onto page icon */

async function setProgressIcon(tabId: number, domain: string, glyph: string) {
  const path = await storage.getDomainIcon(domain)

  const [ctx, size] = getCtx()

  // Firefox can not OffscreenCanvasRenderingContext2D.filter
  // https://wpt.fyi/results/html/canvas/offscreen/manual/filter/offscreencanvas.filter.html
  // so fall back to glyphs instead
  if (path == DEFAULT_ICON || isFirefox()) {
    await drawUpscaled(ctx, path)
    addGlyph(ctx, glyph)
  } else {
    ctx.filter = 'blur(2px)'
    await drawUpscaled(ctx, path)
  }

  await chrome.action.setIcon({
    tabId,
    imageData: {
      [size.toString()]: ctx.getImageData(0, 0, size, size)
    }
  })
}

/* Set page action */

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
    await storage.setDomainIcon(domain, path)
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
