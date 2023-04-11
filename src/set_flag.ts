import type {
  LocalResponse,
  ErrorResponse,
  GeoResponse,
  Data
} from './lib/types.js'

import config from './config.js'
import { getDomain, isLocal, storage, setAction, resolve } from './helpers.js'

async function updatePageAction(tabId: number, domain: string, data: Data) {
  // marked local or is 'localhost'
  if (data.is_local || isLocal(domain)) {
    await setAction(
      tabId,
      `${domain} is a local resource`,
      '/img/local_resource.png'
    )

    return
  }

  // not found
  if ('error' in data) {
    await setAction(tabId, `Error: ${data.error}`, '/img/icon/32.png')

    return
  }

  // we have the data
  if ('country_code' in data) {
    const { country_code, country_name, city, region } = data

    const title = [country_name, region, city].filter(Boolean).join(' → ')
    const iconPath = `/img/flags/${country_code.toLowerCase()}.png`

    await setAction(tabId, title, iconPath)
  }
}

async function request(
  domain: string
): Promise<GeoResponse | ErrorResponse | LocalResponse> {
  const ip = await resolve(domain)

  // domain resolves to local IP
  if (isLocal(ip)) return { ip, is_local: true }

  const url = new URL(config.apiUrl)
  // fallback to server-side resolving
  url.pathname = ip || domain

  const headers = new Headers({
    Accept: 'application/json',
    'x-client-version': config.version
  })

  let response
  // handle network errors
  try {
    response = await fetch(url.toString(), {
      headers,
      credentials: 'omit',
      mode: 'cors'
    })
  } catch (fetchError) {
    return {
      error:
        fetchError instanceof Error
          ? fetchError.message
          : // assume string at this point
            (fetchError as string)
    }
  }

  // handle http errors
  const { ok, status } = response
  if (!ok) {
    const errorText = await response.text()

    let serverError
    try {
      serverError = JSON.parse(errorText) as { error: string; ip?: string }
    } catch (parseError) {
      // error is not valid json therefore string
      serverError = { error: errorText }
    }

    return { status, ...serverError }
  }

  // got data
  return (await response.json()) as GeoResponse
}

const passedMoreThan = (seconds: number, since: number) =>
  new Date().getTime() - since > seconds * 1000
const aMin = 60 // seconds
const day = 24 * 60 * 60 // seconds
const week = 7 * day

async function getCachedResponse(
  domain: string,
  refetch: boolean
): Promise<Data> {
  const baseData = {
    fetched_at: new Date().getTime(),
    is_local: isLocal(domain)
  }

  // use forever-local mode for 'localhost' or local range IP domains
  if (baseData.is_local) return baseData

  const storedData = await storage.get(domain)

  if (!storedData?.fetched_at) {
    return { ...baseData, ...(await request(domain)) }
  }

  // skip network for local and 'marked as local' domains
  if (storedData.is_local) return storedData

  // handle stale data and refetch=true
  const { fetched_at } = storedData

  if (refetch || passedMoreThan(week, fetched_at)) {
    return { ...baseData, ...(await request(domain)) }
  }

  // handle http and netwok errors
  if ('error' in storedData) {
    const { error, status } = storedData

    if (
      // refetch not founds once a day
      (status === 404 && passedMoreThan(day, fetched_at)) ||
      // refetch non-http errors often, maybe network is back
      (error && !status && passedMoreThan(aMin, fetched_at))
    ) {
      return { ...baseData, ...(await request(domain)) }
    }
  }

  return storedData
}

export default async function setFlag(
  { id: tabId, url }: Pick<chrome.tabs.Tab, 'id' | 'url'>,
  { refetch = false } = {}
): Promise<Data | undefined> {
  const domain = getDomain(url)

  if (!tabId) return

  if (!domain) {
    await chrome.action.disable(tabId)
    chrome.action.setTitle({ tabId, title: '😴' })

    return
  } else {
    await chrome.action.enable(tabId)
  }

  const data = await getCachedResponse(domain, refetch)
  await storage.set(domain, data)
  await updatePageAction(tabId, domain, data)

  return data
}
