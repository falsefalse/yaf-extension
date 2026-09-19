import type { Browser } from '@wxt-dev/browser'
import type { Data } from './lib/types'
import { setFlag } from './set_flag'
import {
  getCurrentTab,
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
  }
}

function renderResult(domain: string, data: Data) {
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

    animateRotator()
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

const withLoading = async <T>(fn: () => Promise<T>): Promise<T> => {
  document.body.classList.add('is-loading')
  const result = await fn()
  document.body.classList.remove('is-loading')
  return result
}

async function fetchAndRender(domain: string, tab: Browser.tabs.Tab) {
  const data = await withLoading(() => setFlag(tab, { refetch: true }))

  // no data, nothing to show
  if (!data) return window.close()

  renderResult(domain, data)
}

function delegateEvent<K extends keyof HTMLElementEventMap>(
  container: HTMLElement | null,
  eventName: K,
  selector: string,
  listener: (event: HTMLElementEventMap[K]) => unknown
) {
  container?.addEventListener(eventName, event => {
    if (event.target instanceof Element && event.target.matches(selector))
      listener(event)
  })
}

const DONATION = 'https://savelife.in.ua/en/donate-en/#donate-army-card-once'

type TabConsumer = (tab: Browser.tabs.Tab, domain?: string) => unknown

function withCurrentTab(tabConsumer: TabConsumer) {
  return async () => {
    const currentTab = await getCurrentTab()
    if (!currentTab || !currentTab.id) return window.close()

    await tabConsumer(currentTab, getDomain(currentTab.url))
  }
}

const handleDomReady: TabConsumer = async (currentTab, domain) => {
  if (await isNotPinned()) renderer('#pin')(templates.pin_guide())

  const data = await setFlag(currentTab)

  if (domain && data) renderResult(domain, data)
  else renderer('#result')(templates.internal_page())
}

const delegateEvents: TabConsumer = async (currentTab, domain) => {
  if (!domain) return

  const toolbarEl = document.getElementById('toolbar')
  const resultEl = document.getElementById('result')

  // mark
  delegateEvent(toolbarEl, 'click', 'a.marklocal', async () => {
    let data = await setFlag(currentTab)
    if (!data) return window.close()

    // flip and save
    data = { ...data, is_local: !data.is_local }
    await storage.saveDomain(domain, data)

    // when marked as local – re-render, otherwise refetch
    if (data.is_local) {
      await setFlag(currentTab)
      renderResult(domain, data)
    } else {
      await fetchAndRender(domain, currentTab)
    }
  })

  // reload
  delegateEvent(toolbarEl, 'click', 'a.reload', async ({ metaKey }) => {
    if (metaKey) {
      window.open(DONATION, '_blank', 'noopener,noreferrer')
      window.close()
      return
    }

    await fetchAndRender(domain, currentTab)
  })

  // service link click, timeout somehow makes firefox open link in a new tab
  delegateEvent(resultEl, 'click', 'a.whois', () =>
    setTimeout(() => window.close(), 50)
  )
}

window.addEventListener('DOMContentLoaded', withCurrentTab(delegateEvents))
window.addEventListener('DOMContentLoaded', withCurrentTab(handleDomReady))
