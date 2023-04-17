import type { Data } from './lib/types.js'

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

function animateRotator(duration = 2000, frequency = 4) {
  if (Math.random() > 1 / frequency) return

  document.documentElement.style.setProperty(
    '--js-rotator-duration',
    `${duration}ms`
  )

  document
    .querySelectorAll('.animate')
    .forEach(({ classList }) => classList.add('rotator'))

  setTimeout(
    () =>
      document
        .querySelectorAll('.rotator')
        .forEach(({ classList }) => classList.remove('rotator')),
    duration
  )
}

function renderPopup(domain: string, data: Data) {
  const toolbarEl = document.querySelector('.toolbar')
  const resultEl = document.querySelector('.result')

  if (!toolbarEl || !resultEl) return

  const { is_local } = data

  // 'localhost' and alike domains don't need toolbar
  if (!isLocal(domain)) {
    toolbarEl.innerHTML = toolbar({
      is_local,
      has_mark_button: !('ip' in data)
    })
  }

  // 'marked as local' overrides error
  if (isLocal(domain) || is_local) {
    resultEl.innerHTML = local({
      domain,
      ip: 'ip' in data ? data.ip : ''
    })
    return
  }

  // error
  if ('error' in data) {
    resultEl.innerHTML = not_found({ domain, error: data.error })
    return
  }

  // got data
  if ('country_code' in data) {
    const { country_name, ip, city, region, postal_code } = data

    resultEl.innerHTML = regular({
      country_name,
      domain,
      city,
      region,
      postal_code,
      ip
    })
  }
}

async function fetchAndRender(domain: string, tab: chrome.tabs.Tab) {
  setLoading()
  const data = await setFlag(tab, { refetch: true })
  unsetLoading()
  if (data) renderPopup(domain, data)
}

function delegateEvent<K extends keyof WindowEventMap>(
  eventName: K,
  className: string,
  listener: (event: WindowEventMap[K]) => unknown
) {
  window.addEventListener(eventName, event => {
    if (
      event.target instanceof Element &&
      !event.target.classList.contains(className)
    )
      return

    return listener(event)
  })
}

async function handleDomReady() {
  const [currentTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  })

  // no idea how this could happen, but lets make 🦜 happy
  if (!currentTab) {
    window.close()
    return
  }

  const domain = getDomain(currentTab.url)
  const data = await setFlag(currentTab)

  // happens on extensions page
  if (!domain || !data) {
    window.close()
    return
  }

  renderPopup(domain, data)
  animateRotator()

  // mark
  delegateEvent('click', 'marklocal', async () => {
    let data = await setFlag(currentTab)
    if (!data) return

    // flip and save
    data = { ...data, is_local: !data.is_local }
    await storage.saveDomain(domain, data)

    // when marked as local – re-render, otherwise refetch
    if (data.is_local) {
      await setFlag(currentTab)
      renderPopup(domain, data)
    } else {
      await fetchAndRender(domain, currentTab)
    }
  })

  // reload
  delegateEvent('click', 'reload', async ({ metaKey }) => {
    if (metaKey) {
      window.open(DONATION, '_blank', 'noopener,noreferrer')
      window.close()
      return
    }

    fetchAndRender(domain, currentTab)
  })

  // service link click, timeout somehow makes firefox open link in a new tab
  delegateEvent('click', 'whois', () => setTimeout(() => window.close(), 50))
}

window.addEventListener('DOMContentLoaded', handleDomReady)

export { handleDomReady }
