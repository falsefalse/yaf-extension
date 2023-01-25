/* eslint-env browser, webextensions */

class GeoData {
  constructor(geo) {
    this.geo = geo || null
  }
  valueOf() {
    return this.geo
  }
  get isLocal() {
    return Boolean(this.geo && this.geo.isLocal)
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

function getDomain(url) {
  url = new URL(url)
  if (!['http:', 'https:', 'ftp:'].includes(url.protocol)) return

  return url.hostname
}

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

const storage = {
  set: async (key, value) => {
    try {
      await chrome.storage.local.set({ [key]: value })
    } catch (error) {
      chrome.storage.local.clear()
    }
  },
  get: async key => {
    return (await chrome.storage.local.get(key))[key]
  }
}

export { GeoData, getDomain, isLocal, storage }
