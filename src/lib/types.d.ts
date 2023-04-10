// https://developers.google.com/speed/public-dns/docs/doh/json#dns_response_in_json
export interface DoHResponse {
  /** Standard DNS response code (32 bit integer). */
  Status: number
  Answer?: {
    /** Hostname, always matches `name in the Question section. */
    name: string
    /** A - Standard DNS RR type, 1. */
    type: number
    /** Record's time-to-live in seconds. */
    TTL: number
    /** Data for A - IP address as text. */
    data: string
  }[]
}

interface BaseData {
  /** Epoch timestamp. */
  fetched_at: number
  /** `true` for local domains, `false` otherwise. */
  is_local: boolean
}

export interface LocalResponse {
  /** Local IP (either from domain or resolved to local). */
  ip: string
  /** Always `true` for local IPs. */
  is_local: true
}

export interface ErrorResponse {
  /** `fetch` error or error message returned from server. */
  error: string
  /** HTTP status of the latests request. */
  status?: number
  /** IP returned from server, when geo lookup fails. */
  ip?: string
}

export interface GeoResponse {
  /** ISO2 country code. */
  country_code: string
  /** Human readable country name. */
  country_name: string
  /** Resolved IP. */
  ip: string
  /** City. */
  city?: string
  /** Zip or postal code. */
  postal_code?: string
  /** State, district, subdivision, etc. */
  region?: string
}

interface GeoData extends BaseData, GeoResponse {}
interface ErrorData extends BaseData, ErrorResponse {}

export type Data = BaseData | GeoData | ErrorData
