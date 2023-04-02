/* eslint-env browser, webextensions */

import { LocalResponse, ErrorResponse, GeoResponse, Data } from './types'
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
  data: Data
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
): Promise<GeoResponse | ErrorResponse | LocalResponse> {
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
    const httpError: ErrorResponse = {
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
  { id: tabId, url }: chrome.tabs.Tab,
  { refetch = false } = {}
): Promise<Data | undefined> {
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
