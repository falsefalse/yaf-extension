import type { GeoData, ErrorData } from './lib/types'

type RenderData = GeoData &
  ErrorData & {
    domain: string
    resolved_at_hint: string
  }

type AllKeys = keyof RenderData

/**
 * Render function of a template.
 *
 * `K extends AllKeys | void` makes property autocomplete work for the first type
 * param and at the same time allows `void` when there is nothing to pick.
 * `[K] extends [AllKeys]` keeps the result non distributed, which is what
 * `locals` parameter hints need.
 *
 * @template K string union of RenderData keys the template is going to require
 * @template L optional record, intersected with `Pick<RenderData, K>`
 *
 * @example
 * // pick `is_local` and `ip`, don't add anything
 * Template<'is_local' | 'ip'>
 *
 * @example
 * // pick `is_local`, add `has_mark_button`
 * Template<'is_local', { has_mark_button: boolean }>
 *
 * @example
 * // don't pick anything, use the passed type only
 * Template<void, { required: string; optional?: string }>
 */
type Template<K extends AllKeys | void, L = unknown> = (
  locals: [K] extends [AllKeys] ? Pick<RenderData, K> & L : L
) => string

/** Render nothing for missing values, same as lodash.template did */
const orEmpty = (value: string | undefined) => value ?? ''

const hinted = (value: string | undefined, hint: string) =>
  value ? `<span title="${hint}">${value}</span>` : ''

const RELOAD_TITLE =
  'Click to refresh data&#10;&#10;To support 🇺🇦 Armed Forces of Ukraine&#10;Cmd/Win + Click'

export const toolbar: Template<'is_local', { has_mark_button: boolean }> = ({
  is_local,
  has_mark_button
}) => `
  ${is_local ? '' : `<li class="button reload animate" title="${RELOAD_TITLE}" />`}
  ${
    !has_mark_button
      ? ''
      : is_local
        ? '<li class="button marklocal marked" title="Unmark domain as local" />'
        : '<li class="button marklocal" title="Mark domain as local" />'
  }
`

export const local: Template<
  'domain' | 'is_tailscale',
  { ip?: string; resolved_at_hint?: string }
> = ({ domain, ip, is_tailscale, resolved_at_hint }) => `
  <li class="header">${is_tailscale ? 'Tailscale node' : 'Local resource'}</li>
  <li>${orEmpty(domain)}</li>
  ${ip ? `<li title="${orEmpty(resolved_at_hint)}" class="resolved">${ip}</li>` : ''}
`

export const not_found: Template<'domain' | 'error'> = ({ domain, error }) => `
  <li class="header">${orEmpty(domain)}</li>
  <li>${orEmpty(error)}</li>
`

export const regular: Template<
  | 'domain'
  | 'country_name'
  | 'city'
  | 'region'
  | 'postal_code'
  | 'ip'
  | 'resolved_at_hint'
> = ({
  country_name,
  domain,
  ip,
  city,
  region,
  postal_code,
  resolved_at_hint
}) => {
  const candidates: [string | undefined, string][] = [
    [city, 'City'],
    [region, 'Region'],
    [postal_code, 'Postal Code']
  ]
  const parts = candidates.filter(([value]) => Boolean(value))
  const located = parts.length == 3
  const area = parts.map(([value, hint]) => hinted(value, hint)).join(', ')

  // no white space between area, marker, and </li>
  // so when double clicked text is selected _exactly_, w/o trailing space
  return `
  <li class="header">${hinted(country_name, 'Country')}</li>
  ${area ? `<li>${area}${located ? '<span class="located" title="Located!" />' : ''}</li>` : ''}
  <li>${hinted(ip, resolved_at_hint)}</li>
  ${
    domain
      ? `<li class="separator" />
  <li class="service">
    <a class="whois" href="https://whois.domaintools.com/${domain}"
      title="Open link in a new tab" target="_blank">
      Whois
    </a>
  </li>`
      : ''
  }
`
}
