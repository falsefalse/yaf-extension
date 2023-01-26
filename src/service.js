/* eslint-env browser, webextensions */

import { getDomain, isLocal, storage } from './helpers.js'

/* Draw raster icons onto page action */
const SIZE = 16
const c = new OffscreenCanvas(SIZE, SIZE).getContext('2d', {
  willReadFrequently: true
})
c.width = c.height = SIZE

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

  c.clearRect(0, 0, c.width, c.height)
  c.drawImage(
    img,
    center(c.width, width),
    center(c.height, height),
    width,
    height
  )

  chrome.action.setIcon({
    tabId,
    imageData: c.getImageData(0, 0, SIZE, SIZE)
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

  setIcon(tab, '/img/flags/' + country_code.toLowerCase() + '.png')
  setTitle(tab, title.join(', '))
}

function normalizeData({
  ip,
  country_code,
  country_name,
  city,
  postal_code,
  region
  /* and many more, see server.js#prepareResponse */
}) {
  let normal = { ip, country_code, country_name, city, postal_code }
  normal = Object.keys(normal)
    .filter(key => !!normal[key])
    .reduce((_, key) => ({ ..._, [key]: normal[key] }), {})

  // don't want number-only regions
  if (region && !/^\d+$/.test(region) && region !== city) {
    normal.region = region
  }

  // on the offchance that local IP was returned by VPN DNS or other local DNS
  normal.is_local = isLocal(ip)

  return normal
}

const API_URL = 'http://geoip.furman.im/'

async function request(domain) {
  let data = { error: null }

  const url = new URL(API_URL)
  url.pathname = domain

  let response, json

  // handle fetch failure
  try {
    response = await fetch(url)
  } catch (fetchError) {
    data.error = fetchError.message

    return data
  }

  // handle not found
  if (!response.ok) {
    let errorText = await response.text()
    try {
      errorText = JSON.parse(errorText)
    } catch (parseError) {
      // keep non-json error
      data.error = errorText
      return data
    }

    const { ip, error } = errorText || {}

    // pick up resolved ip if there
    if (ip) data.ip = ip
    // pick error message itself
    data.error = error
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

async function getCachedResponse(domain, reload) {
  // constants
  const day = 60 * 60 * 24 // seconds
  const twoWeeks = day * 14

  // do we already have data for this domain?
  const storedData = await storage.get(domain)

  // we don't have any data at all
  if (!storedData) {
    const newData = {
      fetched_at: new Date().getTime(),
      is_local: isLocal(domain)
    }

    // is the domain itself local? 'localhost' or local range IP
    // use forever-local mode
    if (newData.is_local) return newData

    // resolve domain
    const resolved = await request(domain)
    return { ...newData, ...resolved }
  }

  // at this point we have data
  const { fetched_at, is_local, country_code } = storedData

  // skip network for local domains
  if (is_local) {
    return storedData
  }

  if (
    // reload if asked to
    reload ||
    // refetch data older than 2 weeks
    passedMoreThan(twoWeeks, fetched_at) ||
    // refetch 404s once a day
    (!country_code && passedMoreThan(day, fetched_at))
  ) {
    return await request(domain)
  }

  return storedData
}

async function setFlag(tab, reload) {
  const domain = getDomain(tab.url)
  if (!domain) {
    await chrome.action.disable(tab.id)
    setTitle(tab, '😴')

    return
  } else {
    await chrome.action.enable(tab.id)
  }

  const data = await getCachedResponse(domain, reload)
  await storage.set(domain, data)
  updatePageAction(tab, domain, data)

  return data
}

// update icon when tab is updated
chrome.tabs.onUpdated.addListener((tabId, { status, url } = {}, tab) => {
  // doesn't always come, on refresh doesn't
  url = tab.url
  if (url && (status === 'loading' || status === 'completed')) {
    setFlag(tab)
  }
})

// update icon when tab is selected
chrome.tabs.onActivated.addListener(activeInfo => {
  chrome.tabs.get(activeInfo.tabId, tab => {
    if (!tab || !tab.url) return

    setFlag(tab)
  })
})

export default setFlag
