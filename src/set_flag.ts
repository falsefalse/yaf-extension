import type { Data } from './lib/types.js'
import { lookup } from './helpers/http.js'
import { getDomain, isLocal } from './helpers/misc.js'
import { setPageAction } from './helpers/page_action.js'
import { storage } from './helpers/storage.js'

async function updatePageAction(tabId: number, domain: string, data: Data) {
  // marked local or is 'localhost'
  if (data.is_local || isLocal(domain)) {
    await setPageAction(tabId, domain, { kind: 'local' })

    return
  }

  // not found
  if ('error' in data) {
    await setPageAction(tabId, domain, {
      kind: 'error',
      title: `Error: ${data.error}`
    })

    return
  }

  // we have the data
  if ('country_code' in data) {
    const { country_code, country_name, city, region } = data

    await setPageAction(tabId, domain, {
      kind: 'geo',
      country_code,
      title: [country_name, region, city].filter(Boolean).join(' → ')
    })
  }
}

const passedMoreThan = (seconds: number, since: number) =>
  new Date().getTime() - since > seconds * 1000
const aMin = 60 // seconds
const day = 24 * 60 * 60 // seconds
const week = 7 * day

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
    setPageAction(tabId, domain, { kind: 'loading' })
    return { ...baseData, ...(await lookup(domain)) }
  }

  // skip network for local and 'marked as local' domains
  if (storedData.is_local) return storedData

  // handle stale data and refetch=true
  const { fetched_at } = storedData

  if (refetch || passedMoreThan(week, fetched_at)) {
    setPageAction(tabId, domain, { kind: 'loading' })
    return { ...baseData, ...(await lookup(domain)) }
  }

  // handle http and network errors
  if ('error' in storedData) {
    const { error, status } = storedData

    if (
      // refetch not founds once a day
      (status === 404 && passedMoreThan(day, fetched_at)) ||
      // refetch non-http errors often, maybe network is back
      (error && !status && passedMoreThan(aMin, fetched_at))
    ) {
      setPageAction(tabId, domain, { kind: 'loading' })
      return { ...baseData, ...(await lookup(domain)) }
    }
  }

  return storedData
}

export default async function setFlag(
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
