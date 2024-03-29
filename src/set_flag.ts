import type { Data } from './lib/types.js'
import {
  lookup,
  getDomain,
  isLocal,
  passedMoreThanDay,
  passedMoreThanMinute,
  passedMoreThanWeek,
  setPageAction,
  storage
} from './helpers/index.js'

async function updatePageAction(tabId: number, domain: string, data: Data) {
  // marked local or is 'localhost'
  if (data.is_local || isLocal(domain)) {
    await setPageAction(tabId, { kind: 'local', domain })
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

async function getCachedResponse(
  tabId: number,
  domain: string,
  refetch: boolean
): Promise<Data> {
  const baseData = {
    fetched_at: new Date().getTime(),
    is_local: isLocal(domain)
  }
  // use forever-local mode for 'localhost' or local range IP domains
  if (baseData.is_local) return baseData

  const storedData = await storage.getDomain(domain)

  if (!storedData?.fetched_at) {
    setPageAction(tabId, { kind: 'loading', domain })
    return { ...baseData, ...(await lookup(domain)) }
  }

  // skip network for local and 'marked as local' domains
  if (storedData.is_local) return storedData

  // handle stale data and refetch=true
  const { fetched_at } = storedData

  if (refetch || passedMoreThanWeek(fetched_at)) {
    setPageAction(tabId, { kind: 'loading', domain })
    return { ...baseData, ...(await lookup(domain)) }
  }

  // handle http and network errors
  if ('error' in storedData) {
    const { error, status } = storedData

    if (
      // refetch not founds once a day
      (status === 404 && passedMoreThanDay(fetched_at)) ||
      // refetch non-http errors often, maybe network is back
      (error && !status && passedMoreThanMinute(fetched_at))
    ) {
      setPageAction(tabId, { kind: 'loading', domain })
      return { ...baseData, ...(await lookup(domain)) }
    }
  }

  return storedData
}

export async function setFlag(
  { id: tabId, url }: Pick<chrome.tabs.Tab, 'id' | 'url'>,
  { refetch = false } = {}
): Promise<Data | undefined> {
  if (!tabId) return

  const domain = getDomain(url)

  if (!domain) {
    await chrome.action.disable(tabId)
    chrome.action.setTitle({ tabId, title: '😴' })

    return
  } else {
    await chrome.action.enable(tabId)
  }

  const data = await getCachedResponse(tabId, domain, refetch)
  await storage.saveDomain(domain, data)

  await updatePageAction(tabId, domain, data)

  return data
}
