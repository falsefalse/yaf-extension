/* eslint-env browser, webextensions */

import config from './config.js'
import { getDomain, isLocal, storage } from './helpers.js'

/* Upscale flag icons */

const SIZE = 64
const OG = { width: 16, height: 11 }
const factor = SIZE / OG.width
const center = (whole, part) => Math.round(Math.max(whole - part, 0) / 2)

const ctx = new OffscreenCanvas(SIZE, SIZE).getContext('2d', {
  willReadFrequently: true
})

async function setIcon(tabId, path) {
  const isFlag = path.startsWith('/img/flags/')
  path = '../' + path

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

async function setAction({ id: tabId }, title, iconPath) {
  chrome.action.setTitle({ tabId, title })
  await setIcon(tabId, iconPath)
}

async function updatePageAction(tab, domain, data) {
  const { is_local, error, country_code, country_name, city, region } = data
  // marked local or is 'localhost'
  if (isLocal(domain) || is_local) {
    await setAction(
      tab,
      `${domain} is a local resource`,
      '/img/local_resource.png'
    )

    return
  }

  // not found
  if (!country_code) {
    await setAction(
      tab,
      error ? `Error: ${error}` : 'Country code was not found',
      '/img/icon/32.png'
    )

    return
  }

  // we have the data
  const title = [country_name]
  if (city) title.splice(0, 0, city)
  if (region) title.splice(1, 0, region)

  await setAction(
    tab,
    title.join(', '),
    `/img/flags/${country_code.toLowerCase()}.png`
  )
}

function normalizeData(data) {
  const normal = Object.entries(data)
    .filter(([, value]) => Boolean(value))
    .reduce((_, [key, value]) => ({ ..._, [key]: value }), {})

  const { region, city, ip } = normal

  // don't want number-only regions
  if (region && !/^\d+$/.test(region) && region !== city) {
    normal.region = region
  }

  // on the offchance that local IP was returned by VPN DNS or other local DNS
  normal.is_local = isLocal(ip)

  return normal
}

async function request(domain) {
  let data = { error: null }

  const dohUrl = new URL(config.dohApiUrl)
  dohUrl.searchParams.set('type', '1')
  dohUrl.searchParams.set('name', domain)

  let dohResponse, ips
  try {
    dohResponse = await fetch(dohUrl)
    ips = (await dohResponse.json()).Answer
  } catch (dohError) {
    // TODO: handle google error
  }

  const url = new URL(config.apiUrl)
  url.pathname = ips[0].data

  const headers = new Headers({
    Accept: 'application/json',
    'x-client-version': config.version
  })

  let response, json
  // handle fetch failure
  try {
    response = await fetch(url, { headers, credentials: 'omit', mode: 'cors' })
  } catch (fetchError) {
    data.error = fetchError.message

    return data
  }

  // handle not found
  if (!response.ok) {
    // means we have server-side error
    data.status = response.status

    let errorText = await response.text()
    try {
      errorText = JSON.parse(errorText)
    } catch (parseError) {
      // keep non-json error
      data.error = errorText

      return data
    }
    const { ip, error } = errorText || {}
    if (ip) data.ip = ip
    data.error = error
    // no return, need to normalize because of `ip`
  } else {
    json = await response.json()
  }

  if (json || data) {
    data = normalizeData(json || data)
  }

  return data
}

const passedMoreThan = (seconds, since) =>
  new Date().getTime() - since > seconds * 1000
const aMin = 60 // seconds
const day = 24 * 60 * 60 // seconds
const week = 7 * day

async function getCachedResponse(domain, refetch) {
  // do we already have data for this domain?
  const storedData = await storage.get(domain)

  // in case we don't
  const newData = {
    fetched_at: new Date().getTime(),
    is_local: isLocal(domain)
  }

  // is the domain itself local? 'localhost' or local range IP
  // use forever-local mode
  if (newData.is_local) return newData

  // we don't have any data at all
  if (!storedData || !storedData.fetched_at) {
    return { ...newData, ...(await request(domain)) }
  }

  // at this point we have some data
  const { fetched_at, error, status } = storedData

  // skip network for local and 'marked as local' domains
  if (storedData.is_local) return storedData

  if (
    // refetch if asked to
    refetch ||
    // refetch data older than a week
    passedMoreThan(week, fetched_at) ||
    // refetch not founds once a day
    (status === 404 && passedMoreThan(day, fetched_at)) ||
    // refetch non-http errors often, maybe network is back
    (error && !status && passedMoreThan(aMin, fetched_at))
  ) {
    return { ...newData, ...(await request(domain)) }
  }

  return storedData
}

export default async function setFlag(tab, { refetch } = {}) {
  const domain = getDomain(tab.url)
  if (!domain) {
    await chrome.action.disable(tab.id)
    chrome.action.setTitle({ tabId: tab.id, title: '😴' })

    return
  } else {
    await chrome.action.enable(tab.id)
  }

  const data = await getCachedResponse(domain, refetch)
  await storage.set(domain, data)
  await updatePageAction(tab, domain, data)

  return data
}
