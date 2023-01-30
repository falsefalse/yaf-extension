/* eslint-env browser, webextensions */

import config from './config.js'
import { getDomain, isLocal, storage } from './helpers.js'

/* Draw raster icons onto page action */
const SIZE = 16
const ctx = new OffscreenCanvas(SIZE, SIZE).getContext('2d', {
  willReadFrequently: true
})
ctx.width = ctx.height = SIZE

const center = (whole, part) => Math.round(Math.max(whole - part, 0) / 2)

async function setIcon({ id: tabId }, path) {
  path = '../' + path

  const imgBlob = await (await fetch(path)).blob()
  const img = await createImageBitmap(imgBlob)
  let { width, height } = img

  // we need resizing for rectangular flags, square icons are fine as is
  if (width === height) {
    chrome.action.setIcon({ tabId, path })
    return
  }

  ctx.clearRect(0, 0, ctx.width, ctx.height)
  ctx.drawImage(
    img,
    center(ctx.width, width),
    center(ctx.height, height),
    width,
    height
  )

  chrome.action.setIcon({
    tabId,
    imageData: ctx.getImageData(0, 0, SIZE, SIZE)
  })
}

function setTitle({ id: tabId }, title) {
  chrome.action.setTitle({ tabId, title })
}

function updatePageAction(tab, domain, data) {
  const { is_local, error, country_code, country_name, city, region } = data
  // marked local or is 'localhost'
  if (isLocal(domain) || is_local) {
    setIcon(tab, '/img/local_resource.png')
    setTitle(tab, `${domain} is a local resource`)

    return
  }

  // not found
  if (!country_code) {
    setIcon(tab, '/img/icon/32.png')
    setTitle(tab, error ? `Error: ${error}` : 'Country code was not found')

    return
  }

  // we have the data
  const title = [country_name]
  if (city) title.splice(0, 0, city)
  if (region) title.splice(1, 0, region)

  setIcon(tab, `/img/flags/${country_code.toLowerCase()}.png`)
  setTitle(tab, title.join(', '))
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

  const url = new URL(config.apiUrl)
  url.pathname = domain

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
const twoMins = 2 * 60 // seconds
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
    (error && !status && passedMoreThan(twoMins, fetched_at))
  ) {
    return { ...newData, ...(await request(domain)) }
  }

  return storedData
}

export default async function setFlag(tab, { refetch } = {}) {
  const domain = getDomain(tab.url)
  if (!domain) {
    await chrome.action.disable(tab.id)
    setTitle(tab, '😴')

    return
  } else {
    await chrome.action.enable(tab.id)
  }

  const data = await getCachedResponse(domain, refetch)
  await storage.set(domain, data)
  updatePageAction(tab, domain, data)

  return data
}
