import { GeoData, ErrorData } from './types'

type RenderData = GeoData & ErrorData

type Template<L, K extends keyof D = never, D = RenderData> = (
  locals: L & { [key in K]: D[key] }
) => string

export declare const toolbar: Template<{ has_mark_button: boolean }, 'is_local'>
export declare const local: Template<{ domain: string; ip?: string }>
export declare const not_found: Template<{ domain: string }, 'error'>
export declare const regular: Template<
  { domain: string },
  'country_name' | 'city' | 'region' | 'postal_code' | 'ip'
>
