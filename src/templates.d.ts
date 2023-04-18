import type { GeoData, ErrorData } from './lib/types.js'

type RenderData = GeoData &
  ErrorData & {
    domain: string
    resolved_at_hint: string
  }

type Template<K extends keyof RenderData, L = unknown> = (
  locals: Pick<RenderData, K> & L
) => string

declare const toolbar: Template<'is_local', { has_mark_button: boolean }>
declare const local: Template<'domain' | 'resolved_at_hint', { ip?: string }>
declare const not_found: Template<'domain' | 'error'>
declare const regular: Template<
  | 'domain'
  | 'country_name'
  | 'city'
  | 'region'
  | 'postal_code'
  | 'ip'
  | 'resolved_at_hint'
>

export { toolbar, local, not_found, regular }
