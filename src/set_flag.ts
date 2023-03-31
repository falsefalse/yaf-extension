/* eslint-env browser, webextensions */

import {
  LocalResponse,
  HttpErrorResponse,
  GeoResponse,
  GeoData,
  ErrorData
} from './types'
import {
  getDomain,
  isLocal,
  storage,
  setAction,
  domainToIp
} from './helpers.js'
import config from './config.js'

async function updatePageAction(
  tabId: number | undefined,
  domain: string,
  data: GeoData | ErrorData
) {
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
  if (!('country_code' in data)) {
    const { error } = data

    await setAction(
      tabId,
      error ? `Error: ${error}` : 'Country code was not found',
      '/img/icon/32.png'
    )

    return
  }

  const { country_code, country_name, city, region } = data

  // we have the data
  const title = [country_name]
  if (city) title.splice(0, 0, city)
  if (region) title.splice(1, 0, region)

  await setAction(
    tabId,
    title.join(', '),
    `/img/flags/${country_code.toLowerCase()}.png`
  )
}

async function request(
  domain: string
): Promise<GeoResponse | HttpErrorResponse | LocalResponse> {
  const ip = await domainToIp(domain)

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
  if (!response.ok) {
    const httpError: HttpErrorResponse = {
      status: response.status
    }
    let serverError: { error: string; ip?: string }

    const errorText = await response.text()
    try {
      serverError = JSON.parse(errorText)
    } catch (parseError) {
      // error is not valid json therefore string
      httpError.error = errorText

      return httpError
    }

    return { ...httpError, ...serverError }
  }

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
): Promise<GeoData | ErrorData> {
  const baseData = {
    fetched_at: new Date().getTime(),
    is_local: isLocal(domain)
  }

  // is the domain itself local? 'localhost' or local range IP
  // use forever-local mode
  if (baseData.is_local) return baseData

  // do we already have data for this domain?
  const storedData = await storage.get(domain)

  // if we don't – fire a request
  if (!storedData?.fetched_at) {
    return { ...baseData, ...(await request(domain)) }
  }

  // skip network for local and 'marked as local' domains
  if (storedData.is_local) return storedData

  // do we need to refetch due to errors or stale cache?
  const { fetched_at, error, status } = storedData

  if (
    // refetch if asked to
    refetch ||
    // refetch data older than a week
    passedMoreThan(week, fetched_at) ||
    // refetch not founds once a day
    (status === 404 && passedMoreThan(day, fetched_at)) ||
    // refetch non-http errors often, maybe network is back
    (error && !status && passedMoreThan(aMin, fetched_at))
  ) {
    return { ...baseData, ...(await request(domain)) }
  }

  return storedData
}

export default async function setFlag(
  { id: tabId, url }: chrome.tabs.Tab,
  { refetch = false } = {}
): Promise<GeoData | ErrorData | undefined> {
  const domain = getDomain(url)

  if (!domain) {
    await chrome.action.disable(tabId)
    chrome.action.setTitle({ tabId: tabId, title: '😴' })

    return
  } else {
    await chrome.action.enable(tabId)
  }

  const data = await getCachedResponse(domain, refetch)
  await storage.set(domain, data)
  await updatePageAction(tabId, domain, data)

  return data
}
