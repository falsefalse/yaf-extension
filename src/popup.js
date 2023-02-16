/* eslint-env browser, webextensions */

import setFlag from './set_flag.js'
import { storage, getDomain, isLocal } from './helpers.js'
import { toolbar, local, not_found, regular } from './templates.js'

const DONATION = 'https://savelife.in.ua/en/donate-en/#donate-army-card-once'

function setLoading() {
  document.body.classList.add('is-loading')
}
function unsetLoading() {
  document.body.classList.remove('is-loading')
}

function renderPopup(domain, data) {
  const toolbarEl = document.querySelector('.toolbar')
  const resultEl = document.querySelector('.result')

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
    toolbarEl.innerHTML = toolbar({ ip, is_local })
  }

  // 'marked as local' overrides error
  if (isLocal(domain) || is_local) {
    resultEl.innerHTML = local({ domain, ip })
    return
  }

  // error
  if (error || !country_code) {
    resultEl.innerHTML = not_found({ domain, error })
    return
  }

  // regular case
  resultEl.innerHTML = regular({
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
  let data = await setFlag(currentTab)

  // happens on extensions page
  if (!data) {
    await chrome.action.disable(currentTab.id)
    window.close()
    return
  }

  renderPopup(domain, data)

  // mark
  window.addEventListener('click', async ({ target }) => {
    if (!target.classList.contains('marklocal')) return

    // flip, save and render
    data = { ...data, is_local: !data.is_local }
    await storage.set(domain, data)
    renderPopup(domain, data)

    // update page action
    await setFlag(currentTab)
  })

  // reload
  window.addEventListener('click', async ({ target, metaKey }) => {
    if (!target.classList.contains('reload')) return

    if (metaKey) {
      window.open(DONATION, '_blank', 'noopener,noreferrer')
      window.close()
      return
    }

    setLoading()
    const newData = await setFlag(currentTab, { refetch: true })
    unsetLoading()

    renderPopup(domain, newData)
  })

  // service link click
  window.addEventListener('click', ({ target }) => {
    if (!target.parentElement.classList.contains('service')) return
    setTimeout(() => window.close(), 250)
  })

  // continue for 1/4 of all invocations
  if (Math.random() > 1 / 4) return

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
