/* eslint-env browser, webextensions */

import { GeoData, ErrorData, DoHData } from './types'
import config from './config.js'

function getDomain(url: string | undefined) {
  if (!url) return

  const urlObj = new URL(url)
  if (!['http:', 'https:', 'ftp:'].includes(urlObj.protocol)) return

  return urlObj.hostname
}

function isLocal(ip: string | undefined) {
  if (!ip) return false
  if (ip === 'localhost') return true

  const parsed = ip.split('.').map(oct => parseInt(oct, 10))
  // 127.0.0.1 - 127.255.255.255
  if (parsed[0] === 127) return true
  // 10.0.0.0 - 10.255.255.255
  if (parsed[0] === 10) return true
  // 172.16.0.0 - 172.31.255.255
  if (parsed[0] === 172 && parsed[1] >= 16 && parsed[1] <= 31) return true
  // 192.168.0.0 - 192.168.255.255
  if (parsed[0] === 192 && parsed[1] === 168) return true

  return false
}

const storage = {
  set: async (key: string, value: unknown) => {
    try {
      await chrome.storage.local.set({ [key]: value })
    } catch (error) {
      chrome.storage.local.clear()
    }
  },
  get: async (key: string): Promise<GeoData | ErrorData | undefined> => {
    return (await chrome.storage.local.get(key))[key]
  }
}

/* Upscale flag icons */

const SIZE = 64
const OG = { width: 16, height: 11 }
const factor = SIZE / OG.width
const center = (whole: number, part: number) =>
  Math.round(Math.max(whole - part, 0) / 2)

const ctx = new OffscreenCanvas(SIZE, SIZE).getContext('2d', {
  willReadFrequently: true
})

async function setIcon(tabId: number | undefined, path: string) {
  if (!ctx) throw 'Failed to get 2d canvas context'

  const isFlag = path.startsWith('/img/flags/')
  path = '..' + path

  if (!isFlag) {
    await chrome.action.setIcon({ tabId, path })
    return
  }

  const isNepal = path.endsWith('/np.png')

  const imgBlob = await (await fetch(path)).blob()
  // read 16x11 bitmap, scale it up 4 times, no smoothing
  const bitmap = await createImageBitmap(imgBlob, {
    resizeQuality: 'pixelated',
    resizeWidth: (isNepal ? 9 : OG.width) * factor,
    resizeHeight: OG.height * factor
  })

  // draw bitmap on canvas, center vertically
  ctx.clearRect(0, 0, SIZE, SIZE)
  ctx.drawImage(bitmap, 0, center(SIZE, bitmap.height))

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

async function domainToIp(domain: string) {
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

  let response, data: DoHData
  try {
    response = await fetch(url.toString())
    data = await response.json()
  } catch (error) {
    return
  }

  const { Status: status, Answer: answer } = data

  if (!response.ok || status !== 0 || !answer) return

  return answer.find(({ type }) => type == 1)?.data
}

export { getDomain, isLocal, storage, setAction, domainToIp }
