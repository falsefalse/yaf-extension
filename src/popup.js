/* eslint-env browser, webextensions */

import Tpl from './templates.js'
import setFlag from './service.js'
import { storage, getDomain, isLocal, GeoData } from './helpers.js'

function setLoading() {
  document.body.classList.add('is-loading')
}
function unSetLoading() {
  document.body.classList.remove('is-loading')
}

function renderPopup(domain, { geo, error }) {
  const toolbar = document.querySelector('.toolbar')
  const result = document.querySelector('.result')

  geo = new GeoData(geo)
  // localhost and alike doesn't get the toolbar
  if (!isLocal(domain)) {
    toolbar.innerHTML = Tpl.toolbar_ejs({
      ip: geo.ip,
      isLocal: geo.isLocal
    })
  }

  // 'marked as local' overrides error
  if (isLocal(domain) || geo.isLocal) {
    result.innerHTML = Tpl.local_ejs({ domain, geo: geo.valueOf() })
    return
  }
  geo = geo.valueOf()

  // error
  if (!geo || error) {
    result.innerHTML = Tpl.not_found_ejs({ domain, error })
    return
  }

  // regular case
  result.innerHTML = Tpl.regular_ejs({ domain, geo })
}

window.addEventListener('DOMContentLoaded', async () => {
  const [currentTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  })

  const domain = getDomain(currentTab.url)
  const data = await setFlag(currentTab)

  renderPopup(domain, data)

  // mark
  document.body.addEventListener('click', async event => {
    if (!event.target.classList.contains('toolbar-marklocal')) return

    const currentData = await storage.get(domain)
    const currentGeo = new GeoData(currentData.geo)

    currentGeo.isLocal = !currentGeo.isLocal
    currentData.geo = currentGeo.valueOf()
    await storage.set(domain, currentData)

    await setFlag(currentTab)

    renderPopup(domain, currentData)
  })

  // reload
  document.body.addEventListener('click', async event => {
    if (!event.target.classList.contains('toolbar-reload')) return

    setLoading()
    const newData = await setFlag(currentTab, true)

    unSetLoading()
    renderPopup(domain, newData)
  })
})
