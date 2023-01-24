/*global chrome */

// Render services links for domain/IP and display them in popup

import Tpl from './templates.js'
import { YAF, getDomain, isLocal } from './service.js'

function setLoading() {
  document.body.classList.add('is-loading')
}
function unSetLoading() {
  document.body.classList.remove('is-loading')
}

function renderPopup(domain, data) {
  var toolbar = document.querySelector('.toolbar')
  var result = document.querySelector('.result')

  // toolbar
  toolbar.innerHTML = Tpl.toolbar_ejs({
    geo: data.geo,
    trueLocal: isLocal(domain)
  })

  var mark = toolbar.querySelector('.toolbar-marklocal'),
    reload = toolbar.querySelector('.toolbar-reload')

  // data
  if (data.error) {
    result.innerHTML = Tpl.not_found_ejs({
      domain: domain,
      error: data.error
    })
  } else if (data.geo.isLocal) {
    result.innerHTML = Tpl.local_ejs({
      domain: domain,
      geo: data.geo
    })
  } else {
    result.innerHTML = Tpl.regular_ejs({
      domain: domain,
      geo: data.geo
    })
  }
}

window.addEventListener('DOMContentLoaded', async function () {
  let [currentTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  })

  let domain = getDomain(currentTab.url)
  let data = await YAF.storage.get(domain)

  renderPopup(domain, data)

  // mark
  document.body.addEventListener('click', async function (event) {
    if (!event.target.classList.contains('toolbar-marklocal')) return

    const currentData = await YAF.storage.get(domain)

    if (currentData.geo && currentData.geo.isLocal) {
      delete currentData.geo.isLocal
    } else {
      currentData.geo = currentData.geo || {}
      currentData.geo.isLocal = true
    }

    YAF.storage.set(domain, currentData)
    await YAF.setFlag(currentTab)

    renderPopup(domain, currentData)
  })
  // reload
  document.body.addEventListener('click', async function (event) {
    if (!event.target.classList.contains('toolbar-reload')) return

    setLoading()
    const newData = await YAF.setFlag(currentTab, true)

    unSetLoading()
    renderPopup(domain, newData)
  })
})
