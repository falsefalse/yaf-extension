/* Google DNS over HTTPS */

import config from '../config.js'
import type {
  DoHResponse,
  ErrorResponse,
  GeoResponse,
  LocalResponse
} from '../lib/types.js'
import { isFirefox, isLocal } from './index.js'

export async function resolve(domain: string) {
  if (isFirefox()) {
    try {
      const {
        addresses: [ip]
      } = await browser.dns.resolve(domain, ['disable_ipv6'])
      return ip
    } catch (e) {
      // continue if firefox couldn't resolve domain
    }
  }

  const url = new URL(config.dohApiUrl)
  url.searchParams.set('type', '1')
  url.searchParams.set('name', domain)

  let response, data
  try {
    response = await fetch(url.toString())
    data = (await response.json()) as DoHResponse | undefined
  } catch (error) {
    return
  }

  if (!response.ok || !data || !('Status' in data)) return

  const { Status: status, Answer: answer } = data

  if (status !== 0 || !answer) return

  return answer.find(({ type }) => type == 1)?.data
}

export async function lookup(
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
