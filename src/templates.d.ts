import { GeoData, ErrorData } from './types'

type RenderData = GeoData & ErrorData & { domain: string }

type Template<K extends keyof D, D = RenderData> = (locals: {
  [key in K]: D[key]
}) => string

export declare const toolbar: Template<'ip' | 'is_local'>
export declare const local: Template<'domain' | 'ip'>
export declare const not_found: Template<'domain' | 'error'>
export declare const regular: Template<
  'country_name' | 'domain' | 'city' | 'region' | 'postal_code' | 'ip'
>
