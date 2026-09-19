import type { Browser } from '@wxt-dev/browser'
import type { Data } from './lib/types'
import {
  lookup,
  getDomain,
  isLocal,
  isTailscale,
  passedMoreThanDay,
  passedMoreThanMinute,
  passedMoreThanWeek,
  setPageAction,
  storage
} from './helpers'

async function updatePageAction(tabId: number, domain: string, data: Data) {
  // marked local, 'localhost' or a tailnet node
  if (data.is_local || isLocal(domain)) {
    const { is_tailscale } = data
    await setPageAction(tabId, { kind: 'local', domain, is_tailscale })
    return
  }

  // not found
  if ('error' in data) {
    await setPageAction(tabId, { kind: 'error', domain, error: data.error })
    return
  }

  // we have the data
  if ('country_code' in data) {
    await setPageAction(tabId, { kind: 'geo', domain, data })
    return
  }
}

// setting action is async so we have to await on it and on lookup
async function lookupWithProgress(tabId: number, domain: string) {
  const [, response] = await Promise.all([
    setPageAction(tabId, { kind: 'loading', domain }),
    lookup(domain)
  ])

  return response
}

async function getCachedResponse(
  tabId: number,
  domain: string,
  refetch: boolean
): Promise<Data> {
  const baseData = {
    fetched_at: new Date().getTime(),
    is_local: isLocal(domain),
    ...(isTailscale(domain) && { is_tailscale: true })
  }
  // use forever-local mode for 'localhost', local and tailnet domains
  if (baseData.is_local) return baseData

  const storedData = await storage.getDomain(domain)

  if (!storedData?.fetched_at)
    return { ...baseData, ...(await lookupWithProgress(tabId, domain)) }

  // skip network for local and 'marked as local' domains
  if (storedData.is_local) return storedData

  // handle stale data and refetch=true
  const { fetched_at } = storedData

  if (refetch || passedMoreThanWeek(fetched_at))
    return { ...baseData, ...(await lookupWithProgress(tabId, domain)) }

  // handle http and network errors
  if ('error' in storedData) {
    const { error, status } = storedData

    if (
      // refetch not founds once a day
      (status === 404 && passedMoreThanDay(fetched_at)) ||
      // refetch non-http errors often, maybe network is back
      (error && !status && passedMoreThanMinute(fetched_at))
    )
      return { ...baseData, ...(await lookupWithProgress(tabId, domain)) }
  }

  return storedData
}

export async function setFlag(
  tab?: Pick<Browser.tabs.Tab, 'id' | 'url'>,
  { refetch = false } = {}
) {
  if (!tab?.id) return
  const { id: tabId, url } = tab

  const domain = getDomain(url)

  if (!domain) {
    await setPageAction(tabId, { kind: 'settings_page' })

    return
  }

  const data = await getCachedResponse(tabId, domain, refetch)
  await storage.saveDomain(domain, data)

  await updatePageAction(tabId, domain, data)

  return data
}
