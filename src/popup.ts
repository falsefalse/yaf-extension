/* eslint-env browser, webextensions */

import { Data } from './types'
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

function renderPopup(domain: string, data: Data) {
  const toolbarEl = document.querySelector('.toolbar')
  const resultEl = document.querySelector('.result')

  if (!toolbarEl || !resultEl) return

  const { is_local, ip } = data

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
  if ('error' in data || !('country_code' in data)) {
    resultEl.innerHTML = not_found({ domain, error: data.error })
    return
  }

  const { country_name, city, region, postal_code } = data

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

const delegateEvent = <K extends keyof WindowEventMap>(
  eventName: K,
  className: string,
  listener: (event: WindowEventMap[K]) => unknown
) => {
  window.addEventListener(eventName, event => {
    if (!(event.target instanceof Element)) return
    if (!event.target.classList.contains(className)) return

    return listener(event)
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
  if (!data || !domain) {
    await chrome.action.disable(currentTab.id)
    window.close()
    return
  }

  renderPopup(domain, data)

  // mark
  delegateEvent('click', 'marklocal', async () => {
    if (!data) return

    // flip, save and render
    data = { ...data, is_local: !data.is_local }
    await storage.set(domain, data)
    renderPopup(domain, data)

    // update page action
    await setFlag(currentTab)
  })

  // reload
  delegateEvent('click', 'reload', async ({ metaKey }) => {
    if (metaKey) {
      window.open(DONATION, '_blank', 'noopener,noreferrer')
      window.close()
      return
    }

    setLoading()
    const newData = await setFlag(currentTab, { refetch: true })
    unsetLoading()

    if (newData) renderPopup(domain, newData)
  })

  // service link click, timeout somehow makes firefox open link in a new tab
  delegateEvent('click', 'whois', () => setTimeout(() => window.close(), 50))

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
