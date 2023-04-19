import type { GeoData, ErrorData } from './lib/types.js'

type RenderData = GeoData &
  ErrorData & {
    domain: string
    resolved_at_hint: string
  }

type AllKeys = keyof RenderData

/*
  K — string union of RenderData keys template is going to require
  L — optional record, intersected with RenderData[K]

  `K extends AllKeys | void`
    this makes property autocomplete work for first type param
    at the same time allows to pass `void` when you don't need to pick anything
  [K] extends [AllKeys]
    makes the result non distributed which is desired for `locals` parameter hints

  Template<'is_local' | 'ip'>
    pick `is_local` and `ip`, don't add anything

  Template<'is_local', { has_mark_button: boolean }>
    pick `is_local`, add `has_mark_button`

  Template<void, { required: string; optional?: string }>
    don't pick anything, use passed type only
*/
type Template<K extends AllKeys | void, L = unknown> = (
  locals: [K] extends [AllKeys] ? Pick<RenderData, K> & L : L
) => string

declare const toolbar: Template<'is_local', { has_mark_button: boolean }>

declare const local: Template<
  'domain',
  { ip?: string; resolved_at_hint?: string }
>

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
