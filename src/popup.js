/* eslint-env browser, webextensions */

import T from './templates.js'
import setFlag from './set_flag.js'
import { storage, getDomain, isLocal } from './helpers.js'

function setLoading() {
  document.body.classList.add('is-loading')
}
function unSetLoading() {
  document.body.classList.remove('is-loading')
}

function renderPopup(domain, data) {
  const toolbar = document.querySelector('.toolbar')
  const result = document.querySelector('.result')

  const {
    error,
    is_local,
    ip,
    country_code,
    country_name,
    city,
    region,
    postal_code
  } = data

  // 'locahost' and alike domains don't need toolbar
  if (!isLocal(domain)) {
    toolbar.innerHTML = T.toolbar_ejs({ ip, is_local })
  }

  // 'marked as local' overrides error
  if (isLocal(domain) || is_local) {
    result.innerHTML = T.local_ejs({ domain, ip })
    return
  }

  // error
  if (error || !country_code) {
    result.innerHTML = T.not_found_ejs({ domain, error })
    return
  }

  // regular case
  result.innerHTML = T.regular_ejs({
    country_name,
    domain,
    city,
    region,
    postal_code,
    ip
  })
}

window.addEventListener('DOMContentLoaded', async () => {
  const [currentTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  })

  const domain = getDomain(currentTab.url)
  const data = await setFlag(currentTab)

  // happens on extensions page
  if (!data) {
    await chrome.action.disable(currentTab.id)
    window.close()
    return
  }

  renderPopup(domain, data)

  // mark
  document.body.addEventListener('click', async event => {
    if (!event.target.classList.contains('toolbar-marklocal')) return

    const currentData = await storage.get(domain)
    currentData.is_local = !currentData.is_local

    await storage.set(domain, currentData)
    await setFlag(currentTab)

    renderPopup(domain, currentData)
  })

  // reload
  document.body.addEventListener('click', async ({ target, metaKey }) => {
    if (!target.classList.contains('toolbar-reload')) return

    if (metaKey) {
      window.open(
        'https://savelife.in.ua/en/donate-en/#donate-army-card-once',
        '_blank',
        'noopener,noreferrer'
      )
    }

    setLoading()
    const newData = await setFlag(currentTab, true)

    unSetLoading()
    renderPopup(domain, newData)
  })

  if (Math.random() > 1 / 3) {
    return
  }
  document
    .querySelectorAll('.animate')
    .forEach(({ classList }) => classList.add('rotator'))

  setTimeout(
    () =>
      document
        .querySelectorAll('.rotator')
        .forEach(({ classList }) => classList.remove('rotator')),
    2 * 1000
  )
})
