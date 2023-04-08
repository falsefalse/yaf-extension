import type { GeoData, ErrorData } from './lib/types.js'

type RenderData = GeoData & ErrorData

type Template<L, K extends keyof RenderData = never> = (
  locals: L & Pick<RenderData, K>
) => string

declare const toolbar: Template<{ has_mark_button: boolean }, 'is_local'>
declare const local: Template<{ domain: string; ip?: string }>
declare const not_found: Template<{ domain: string }, 'error'>
declare const regular: Template<
  { domain: string },
  'country_name' | 'city' | 'region' | 'postal_code' | 'ip'
>

export { toolbar, local, not_found, regular }
