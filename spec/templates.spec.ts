import { format } from 'prettier/standalone'
import * as htmlPlugin from 'prettier/plugins/html'

import {
  internal_page,
  local,
  not_found,
  pin_guide,
  regular,
  toolbar
} from '../src/templates'

// same quotes, closing tags and whitespace for every template
const html = (markup: string) =>
  format(markup, { parser: 'html', plugins: [htmlPlugin] })

describe('templates', () => {
  describe('local', () => {
    it('renders domain', async () => {
      expect(await html(local({ domain: 'bo.op' }))).toMatchInlineSnapshot(`
        "<li class="header">Local resource</li>
        <li>bo.op</li>
        "
      `)
    })

    it('renders Tailscale node header', async () => {
      expect(
        await html(local({ domain: 'ma.chine.ts.net', is_tailscale: true }))
      ).toMatchInlineSnapshot(`
        "<li class="header">Tailscale node</li>
        <li>ma.chine.ts.net</li>
        "
      `)
    })

    it('renders IP address', async () => {
      expect(
        await html(
          local({
            domain: 'boo.op',
            ip: 'x.x.x.x',
            resolved_at_hint: "I'm Muzzy I eat clocks"
          })
        )
      ).toMatchInlineSnapshot(`
        "<li class="header">Local resource</li>
        <li>boo.op</li>
        <li title="I'm Muzzy I eat clocks" class="resolved">x.x.x.x</li>
        "
      `)

      expect(await html(local({ domain: 'boo.op', ip: 'x.x.x.x' })))
        .toMatchInlineSnapshot(`
        "<li class="header">Local resource</li>
        <li>boo.op</li>
        <li title="" class="resolved">x.x.x.x</li>
        "
      `)
    })

    it('does not explode without data', async () => {
      // @ts-expect-error: templates spec
      expect(await html(local({}))).toMatchInlineSnapshot(`
        "<li class="header">Local resource</li>
        <li></li>
        "
      `)
    })
  })

  describe('not_found', () => {
    it('renders domain and error', async () => {
      expect(await html(not_found({ domain: 'ooo.op', error: 'nope!' })))
        .toMatchInlineSnapshot(`
        "<li class="header">ooo.op</li>
        <li>nope!</li>
        "
      `)
    })

    it('does not explode without data', async () => {
      // @ts-expect-error: templates spec
      expect(await html(not_found({}))).toMatchInlineSnapshot(`
        "<li class="header"></li>
        <li></li>
        "
      `)
    })
  })

  describe('regular', () => {
    it('renders 📍 when city, region and postal code are present', async () => {
      expect(
        await html(
          regular({
            domain: 'furman.im',
            ip: 'z.z.z.z',
            country_name: 'Ukraine',
            city: 'Kyiv',
            region: 'Kyiv City',
            postal_code: '03453',
            resolved_at_hint: "I'm Muzzy I eat clocks"
          })
        )
      ).toMatchInlineSnapshot(`
        "<li class="header"><span title="Country">Ukraine</span></li>
        <li>
          <span title="City">Kyiv</span>, <span title="Region">Kyiv City</span>,
          <span title="Postal Code">03453</span
          ><span class="located" title="Located!" />
        </li>
        <li><span title="I'm Muzzy I eat clocks">z.z.z.z</span></li>
        <li class="separator" />
        <li class="service">
          <a
            class="whois"
            href="https://whois.domaintools.com/furman.im"
            title="Open link in a new tab"
            target="_blank"
          >
            Whois
          </a>
        </li>
        "
      `)
    })

    it('renders geo data', async () => {
      expect(
        await html(
          regular({
            domain: 'geo.furman.im',
            ip: 'yyy.yyy.yyy.yyy',
            country_name: 'Romania',
            postal_code: '88014',
            resolved_at_hint: "I'm Muzzy I eat clocks"
          })
        )
      ).toMatchInlineSnapshot(`
        "<li class="header"><span title="Country">Romania</span></li>
        <li><span title="Postal Code">88014</span></li>
        <li><span title="I'm Muzzy I eat clocks">yyy.yyy.yyy.yyy</span></li>
        <li class="separator" />
        <li class="service">
          <a
            class="whois"
            href="https://whois.domaintools.com/geo.furman.im"
            title="Open link in a new tab"
            target="_blank"
          >
            Whois
          </a>
        </li>
        "
      `)
    })

    it('does not explode without data, skips whois link', async () => {
      // @ts-expect-error: templates spec
      expect(await html(regular({}))).toMatchInlineSnapshot(`
        "<li class="header"></li>

        <li></li>
        "
      `)
    })
  })

  describe('toolbar', () => {
    it('renders reload button', async () => {
      expect(await html(toolbar({ is_local: false, has_mark_button: false })))
        .toMatchInlineSnapshot(`
        "<a
          class="button reload animate"
          title="Click to refresh data&#10;&#10;To support 🇺🇦 Armed Forces of Ukraine&#10;Cmd/Win + Click"
        />
        "
      `)
    })

    it('renders mark button', async () => {
      expect(await html(toolbar({ is_local: false, has_mark_button: true })))
        .toMatchInlineSnapshot(`
        "<a
          class="button reload animate"
          title="Click to refresh data&#10;&#10;To support 🇺🇦 Armed Forces of Ukraine&#10;Cmd/Win + Click"
        />
        <a class="button marklocal" title="Mark domain as local" />
        "
      `)
    })

    it('renders unmark button', async () => {
      expect(await html(toolbar({ is_local: true, has_mark_button: true })))
        .toMatchInlineSnapshot(`
        "<a class="button marklocal marked" title="Unmark domain as local" />
        "
      `)
    })

    it('does not explode and renders reload button without data', async () => {
      // @ts-expect-error: templates spec
      expect(await html(toolbar({}))).toMatchInlineSnapshot(`
        "<a
          class="button reload animate"
          title="Click to refresh data&#10;&#10;To support 🇺🇦 Armed Forces of Ukraine&#10;Cmd/Win + Click"
        />
        "
      `)
    })
  })

  describe('pin_guide', () => {
    it('renders', async () => {
      expect(await html(pin_guide())).toMatchInlineSnapshot(`
        "<div>Click <strong class="pin_guide">puzzle piece icon</strong></div>
        to pin the extension.
        "
      `)
    })
  })

  describe('internal_page', () => {
    it('renders', async () => {
      expect(await html(internal_page())).toMatchInlineSnapshot(`
        "<li class="header">Internal browser page</li>
        <li>No data to show.</li>
        "
      `)
    })
  })
})
