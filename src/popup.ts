import type { Browser } from '@wxt-dev/browser'
import type { Data } from './lib/types'
import { setFlag } from './set_flag'
import {
  getDomain,
  isLocal,
  isNotPinned,
  resolvedAtHint,
  storage
} from './helpers'
import * as templates from './templates'

function animateRotator(frequency = 16) {
  if (Math.random() > 1 / frequency) return

  document.querySelectorAll('.animate').forEach(el => {
    const stop = () => el.classList.remove('rotator')
    el.addEventListener('animationend', stop, { once: true })
    el.classList.add('rotator')
  })
}

function renderer(selector: string) {
  return function (html: string) {
    const el = document.querySelector(selector)
    if (!el) return
    el.innerHTML = html
    return el
  }
}

function renderPopup(domain: string, data: Data) {
  const toolbar = renderer('#toolbar')
  const result = renderer('#result')

  const { is_local, is_tailscale, fetched_at } = data
  const resolved_at_hint = resolvedAtHint(fetched_at)

  // 'localhost' and alike domains don't need toolbar
  if (!isLocal(domain)) {
    toolbar(
      templates.toolbar({
        is_local,
        has_mark_button: !('ip' in data)
      })
    )
  }

  // 'marked as local' overrides error
  if (isLocal(domain) || is_local) {
    result(
      templates.local({
        resolved_at_hint,
        domain,
        is_tailscale,
        ip: 'ip' in data ? data.ip : ''
      })
    )
    return
  }

  // error
  if ('error' in data) {
    result(templates.not_found({ domain, error: data.error }))
    return
  }

  // got data
  if ('country_code' in data) {
    const { country_name, ip, city, region, postal_code } = data

    result(
      templates.regular({
        resolved_at_hint,
        country_name,
        domain,
        city,
        region,
        postal_code,
        ip
      })
    )
  }
}

async function fetchAndRender(domain: string, tab: Browser.tabs.Tab) {
  document.body.classList.add('is-loading')
  const data = await setFlag(tab, { refetch: true })
  document.body.classList.remove('is-loading')

  // no data, nothing to show
  if (!data) {
    window.close()
    return
  }

  renderPopup(domain, data)
}

function delegatedEvent<K extends keyof HTMLElementEventMap>(
  container: HTMLElement,
  eventName: K,
  className: string,
  listener: (event: HTMLElementEventMap[K]) => unknown
) {
  container.addEventListener(eventName, event => {
    if (
      event.target instanceof Element &&
      !event.target.classList.contains(className)
    )
      return

    return listener(event)
  })
}

const DONATION = 'https://savelife.in.ua/en/donate-en/#donate-army-card-once'

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

  if (await isNotPinned()) renderer('#pin')(templates.pin_guide())

  // internal browser pages
  if (!domain) {
    renderer('#result')(templates.internal_page())
    return
  }

  // no data came in, meaning no tab id, nothing to work with
  if (!data) {
    window.close()
    return
  }

  renderPopup(domain, data)
  animateRotator()

  const toolbarEl = document.querySelector<HTMLElement>('#toolbar')
  const resultEl = document.querySelector<HTMLElement>('#result')
  // popup.html always has both, specs may not
  if (!toolbarEl || !resultEl) return

  // mark
  delegatedEvent(toolbarEl, 'click', 'marklocal', async () => {
    let data = await setFlag(currentTab)
    if (!data) {
      window.close()
      return
    }

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
  delegatedEvent(toolbarEl, 'click', 'reload', async ({ metaKey }) => {
    if (metaKey) {
      window.open(DONATION, '_blank', 'noopener,noreferrer')
      window.close()
      return
    }

    await fetchAndRender(domain, currentTab)
  })

  // service link click, timeout somehow makes firefox open link in a new tab
  delegatedEvent(resultEl, 'click', 'whois', () =>
    setTimeout(() => window.close(), 50)
  )
}

window.addEventListener('DOMContentLoaded', handleDomReady)
