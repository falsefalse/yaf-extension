import type { Data, DoHResponse } from './lib/types.js'

import config from './config.js'

function getDomain(url: string | undefined) {
  if (!url) return

  const urlObj = new URL(url)
  if (!['http:', 'https:', 'ftp:'].includes(urlObj.protocol)) return

  return urlObj.hostname
}

function isLocal(ip: string | undefined): ip is string {
  if (!ip) return false

  if (ip == 'localhost') return true

  const octets = ip.split('.').map(oct => parseInt(oct, 10))
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
  get: async (key: string): Promise<Data | undefined> =>
    (await chrome.storage.local.get(key))[key]
}

/* Upscale flags */

const center = (whole: number, part: number) =>
  Math.round(Math.max(whole - part, 0) / 2)

const SIZE = 64
// pretend all flags are boxed in 16px wide box, gives nice scale factor
// (they all are apart from 16x9 Nepal 🇳🇵 )
const scale = SIZE / 16

async function setIcon(tabId: number | undefined, path: string) {
  const ctx = new OffscreenCanvas(SIZE, SIZE).getContext('2d', {
    willReadFrequently: true
  })

  if (!ctx) throw new Error('Failed to get 2d canvas context')

  if (!path.startsWith('/img/flags/')) {
    await chrome.action.setIcon({ tabId, path })
    return
  }

  // read image and its dimensions
  const imgBlob = await (await fetch(path)).blob()
  const { width, height } = await createImageBitmap(imgBlob)

  // upscale without smoothing
  const upscaled = await createImageBitmap(imgBlob, {
    resizeQuality: 'pixelated',
    resizeWidth: width * scale,
    resizeHeight: height * scale
  })

  // draw bitmap on canvas, centering it
  ctx.clearRect(0, 0, SIZE, SIZE)
  ctx.drawImage(
    upscaled,
    center(SIZE, upscaled.width),
    center(SIZE, upscaled.height)
  )

  // pass bitmap to browser
  await chrome.action.setIcon({
    tabId,
    imageData: { [SIZE.toString()]: ctx.getImageData(0, 0, SIZE, SIZE) }
  })
}

async function setAction(
  tabId: number | undefined,
  title: string,
  iconPath: string
) {
  chrome.action.setTitle({ tabId, title })
  await setIcon(tabId, iconPath)
}

async function resolve(domain: string) {
  if ('dns' in chrome) {
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

export { getDomain, isLocal, storage, setAction, resolve }
