// https://developers.google.com/speed/public-dns/docs/doh/json#dns_response_in_json
export type DoHData = {
  Status: number // Standard DNS response code (32 bit integer).
  Answer?: {
    name: string // Always matches name in the Question section
    type: number // A - Standard DNS RR type
    TTL: number // Record's time-to-live in seconds
    data: string // Data for A - IP address as text
  }[]
}

export interface BaseData {
  fetched_at: number
  is_local: boolean
}

export interface LocalResponse {
  ip: string
  is_local: boolean
}

export interface HttpErrorResponse {
  status?: number
  error?: string
  ip?: string
}

// we want to be able to destructure `status` and `error` hence extends
export interface GeoResponse extends HttpErrorResponse {
  country_code: string
  country_name: string
  ip?: string
  city?: string
  postal_code?: string
  region?: string
}

export interface GeoData extends BaseData, GeoResponse {}
export interface ErrorData extends BaseData, HttpErrorResponse {}

export interface RenderData extends GeoData {
  domain: string
}
