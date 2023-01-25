/* eslint-env browser, webextensions */

import { getDomain, isLocal, GeoData, storage } from './helpers.js'

// helpers
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
  if (isLocal(ip)) normal.isLocal = true

  return normal
}

function passedMoreThan(seconds, date) {
  return new Date().getTime() - date > seconds * 1000
}

const SIZE = 20
const c = new OffscreenCanvas(SIZE, SIZE).getContext('2d', {
  willReadFrequently: true
})
c.width = c.height = SIZE

const center = (whole, part) => Math.round(Math.max(whole - part, 0) / 2)

async function setIcon(tabId, path) {
  path = '../' + path
  const imgBlob = await (await fetch(path)).blob()
  const img = await createImageBitmap(imgBlob)

  let { width, height } = img
  if (width === height && width > SIZE) {
    width = height = 16
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

function setTitle(tabId, title) {
  chrome.action.setTitle({ tabId, title })
}

function titleFor(geo, domain) {
  // local
  if (isLocal(domain) || geo.isLocal) {
    return `${domain} is a local resource`
  }
  // no country code
  if (!geo.country_code) {
    return 'Country code was not found'
  }
}

function updatePageAction(tab, domain, { geo, error }) {
  geo = new GeoData(geo)
  // marked local or is 'localhost'
  if (isLocal(domain) || geo.isLocal) {
    setIcon(tab.id, '/img/local_resource.png')
    setTitle(tab.id, titleFor(geo, domain))

    return
  }
  geo = geo.valueOf()

  // not found
  if (!geo || !geo.country_code) {
    setIcon(tab.id, '/img/icon/16.png')
    setTitle(tab.id, error || titleFor(geo, domain))

    return
  }

  // we have the data
  const title = [geo.country_name]
  if (geo.city) title.splice(0, 0, geo.city)
  if (geo.region) title.splice(1, 0, geo.region)

  setIcon(tab.id, '/img/flags/' + geo.country_code.toLowerCase() + '.png')
  setTitle(tab.id, title.join(', '))
}

// const API_URL = 'http://geo.furman.im:8080/'
const API_URL = 'http://localhost:8080/'

async function request(domain) {
  const data = {
    date: new Date().getTime(),
    geo: null
  }

  const url = new URL(API_URL)
  url.pathname = domain

  let response, json
  try {
    response = await fetch(url)
  } catch (error) {
    data.error = error.message

    return data
  }

  if (!response.ok) {
    let errorResp = await response.text()
    try {
      errorResp = JSON.parse(errorResp)
    } catch (pe) {
      // keep non-json error
      data.error = errorResp
      return data
    }

    const { ip, error } = errorResp || {}

    // pick up resolved ip if there
    if (ip) data.geo = { ip }
    // pick error message itself
    data.error = error
  } else {
    json = await response.json()
  }

  if (json || data.geo) {
    data.geo = normalizeData(json || data.geo)
  }

  return data
}

async function getCachedGeo(domain, reload) {
  // constants
  const day = 60 * 60 * 24 // seconds
  const twoWeeks = day * 14

  // do we already have data for this domain?
  const data = (await storage.get(domain)) || {}
  const geo = new GeoData(data.geo)

  // skip network for local domains
  if (isLocal(domain) || geo.isLocal) {
    return { ...data, geo: geo.valueOf() }
  }

  if (data.date && !reload) {
    // if data has been stored for 2 weeks - refetch it
    if (passedMoreThan(twoWeeks, data.date)) {
      return await request(domain)
      // refetch 404s once a day
    } else if (!data.geo && passedMoreThan(day, data.date)) {
      return await request(domain)
    } else {
      return data
    }
  } else {
    return await request(domain)
  }
}

async function setFlag(tab, reload) {
  const domain = getDomain(tab.url)
  if (!domain) {
    await chrome.action.disable(tab.id)
    setTitle(
      tab.id,
      'Extension is disabled for this page, try real website instead!'
    )

    return
  } else {
    await chrome.action.enable(tab.id)
  }

  const geoData = await getCachedGeo(domain, reload)
  await storage.set(domain, geoData)
  updatePageAction(tab, domain, geoData)

  return geoData
}

// update icon when tab is updated
chrome.tabs.onUpdated.addListener((tabId, { status, url } = {}, tab) => {
  if (url && status === 'loading') {
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
