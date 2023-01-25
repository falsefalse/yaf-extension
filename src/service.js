/* eslint-env browser, webextensions */

// helpers
function isLocal(ip) {
  if (!ip) return false
  if (ip === 'localhost') return true

  ip = ip.split('.').map(function (oct) {
    return parseInt(oct, 10)
  })
  // 127.0.0.1 - 127.255.255.255
  if (ip[0] === 127) return true
  // 10.0.0.0 - 10.255.255.255
  if (ip[0] === 10) return true
  // 172.16.0.0 - 172.31.255.255
  if (ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31) return true
  // 192.168.0.0 - 192.168.255.255
  if (ip[0] === 192 && ip[1] === 168) return true

  return false
}

function normalizeData(raw) {
  const normal = {
    ip: raw.ip,
    country_code: raw.country_code,
    country_name: raw.country_name,
    city: raw.city,
    postal_code: raw.postal_code
  }
  // don't want number-only regions
  // and regions that are the same as the city
  if (raw.region && !/^\d+$/.test(raw.region) && raw.region !== raw.city) {
    normal.region = raw.region
  }

  // on the offchance that local IP was returned by VPN DNS or other local DNS
  if (isLocal(raw.ip)) normal.isLocal = true

  return normal
}

function getDomain(url) {
  url = new URL(url)
  if (!['http:', 'https:', 'ftp:'].includes(url.protocol)) return

  return url.hostname
}

function passedMoreThan(seconds, date) {
  return new Date().getTime() - date > seconds * 1000
}

const SIZE = 19
const c = new OffscreenCanvas(SIZE, SIZE).getContext('2d', {
  willReadFrequently: true
})
c.width = c.height = SIZE

function center(whole, part) {
  return Math.round((whole - part) / 2)
}

async function setIcon(tabId, path) {
  path = '../' + path
  const imgBlob = await fetch(path).then(r => r.blob())
  const img = await createImageBitmap(imgBlob)

  c.clearRect(0, 0, c.width, c.height)
  c.drawImage(
    img,
    center(c.width, img.width),
    center(c.height, img.height),
    img.width,
    img.height
  )

  chrome.action.setIcon({
    tabId,
    imageData: c.getImageData(0, 0, SIZE, SIZE)
  })
}

function updatePageAction(tab, domain, { geo, error }) {
  geo = new GeoData(geo)

  // marked local or is 'localhost'
  if (isLocal(domain) || geo.isLocal) {
    setIcon(tab.id, 'img/local_resource.png')
    chrome.action.setTitle({
      tabId: tab.id,
      title: domain + ' is a local resource'
    })
    return
  }

  // not found
  if (!geo.valueOf()) {
    setIcon(tab.id, 'img/icon/16.png')
    chrome.action.setTitle({
      tabId: tab.id,
      title: error || "'" + domain + "' was not found in database"
    })

    return
  }

  // we have the data
  geo = geo.valueOf()
  const title = [geo.country_name]
  if (geo.city) title.splice(0, 0, geo.city)
  if (geo.region) title.splice(1, 0, geo.region)

  setIcon(tab.id, 'img/flags/' + geo.country_code.toLowerCase() + '.png')
  chrome.action.setTitle({
    tabId: tab.id,
    title: title.join(', ')
  })
}

const API_URL = 'http://geo.furman.im:8080/'
var YAF = {
  request: async function (domain) {
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
      data.error = error
      return data
    }
    if (!response.ok) {
      data.error = await response.text()
      return data
    } else {
      json = await response.json()
    }
    data.geo = normalizeData(json)

    return data
  },
  getGeoData: async function (domain, reload) {
    // constants
    const day = 60 * 60 * 24 // seconds
    const twoWeeks = day * 14

    // do we already have data for this domain?
    const data = (await YAF.storage.get(domain)) || {}
    const geo = new GeoData(data.geo)

    // skip network for local domains
    if (isLocal(domain) || geo.isLocal) {
      return { ...data, geo: geo.valueOf() }
    }

    if (data.date && !reload) {
      // if data has been stored for 2 weeks - refetch it
      if (passedMoreThan(twoWeeks, data.date)) {
        return await this.request(domain)
        // refetch 404s once a day
      } else if (!data.geo && passedMoreThan(day, data.date)) {
        return await this.request(domain)
      } else {
        return data
      }
    } else {
      return await this.request(domain)
    }
  },

  setFlag: async function (tab, reload) {
    const domain = getDomain(tab.url)
    if (!domain) {
      await chrome.action.disable(tab.id)
      chrome.action.setTitle({
        tabId: tab.id,
        title: 'Extension is disabled for this page, try real website instead!'
      })

      return
    } else {
      await chrome.action.enable(tab.id)
    }

    const geoData = await this.getGeoData(domain, reload)
    await YAF.storage.set(domain, geoData)
    updatePageAction(tab, domain, geoData)

    return geoData
  }
}

class GeoData {
  constructor(geo) {
    this.geo = geo || null
  }
  valueOf() {
    return this.geo
  }
  get isLocal() {
    return this.geo && this.geo.isLocal
  }
  get ip() {
    return this.geo && this.geo.ip
  }
  set isLocal(value) {
    if (!this.geo) {
      this.geo = { isLocal: value }
    } else {
      this.geo.isLocal = value
    }

    if (!this.geo.isLocal) {
      delete this.geo.isLocal
      if (Object.keys(this.geo).length > 0) return
      this.geo = null
    }
  }
}

// update icon when tab is updated
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (changeInfo.status !== 'complete') {
    return
  }
  YAF.setFlag(tab)
})

// update icon when tab is selected
chrome.tabs.onActivated.addListener(function (activeInfo) {
  // TODO: execute only if domain has changed
  chrome.tabs.get(activeInfo.tabId, function (tab) {
    if (!tab || !tab.url) return

    YAF.setFlag(tab)
  })
})

YAF.storage = {
  set: async function (key, value) {
    try {
      await chrome.storage.local.set({ [key]: value })
    } catch (error) {
      chrome.storage.local.clear()
    }
  },
  get: async function (key) {
    return (await chrome.storage.local.get(key))[key]
  }
}

export { YAF, getDomain, isLocal, GeoData }
