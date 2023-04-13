import { expect } from 'chai'

import { local, not_found, regular, toolbar } from '../src/templates.js'

describe('templates/', () => {
  let r: string

  describe('local.ejs', () => {
    it('renders domain', () => {
      r = local({ domain: 'bo.op' })

      expect(r).htmll.to.equal(
        '<li class="header">Local resource</li><li>bo.op</li>'
      )
    })

    it('renders ip', () => {
      r = local({ domain: 'boo.op', ip: 'x.x.x.x' })

      expect(r).htmll.to.equal(`
        <li class="header">Local resource</li>
        <li>boo.op</li>
        <li title="Resolved IP address" class="resolved">x.x.x.x</li>`)
    })

    it('does not explode without data', () => {
      // @ts-expect-error: templates spec
      r = local({})

      expect(r).htmll.to.equal(
        '<li class="header">Local resource</li><li></li>'
      )
    })
  })

  describe('not_found.ejs', () => {
    it('renders domain and error', () => {
      r = not_found({ domain: 'ooo.op', error: 'nope!' })

      expect(r).htmll.to.equal(`<li class="header">ooo.op</li><li>nope!</li>`)
    })

    it('does not explode without data', () => {
      // @ts-expect-error: templates spec
      r = not_found({})

      expect(r).htmll.to.equal('<li class="header"></li><li></li>')
    })
  })

  describe('regular.ejs', () => {
    it('renders 📍 when city, region and postal code are present', () => {
      r = regular({
        domain: 'furman.im',
        ip: 'z.z.z.z',
        country_name: 'Ukraine',
        city: 'Kyiv',
        region: 'Kyiv City',
        postal_code: '03453'
      })

      expect(r).htmll.to.equal(`
        <li class="header"><span title='Country'>Ukraine</span></li>
        <li>
          <span title='City'>Kyiv</span>, <span title='Region'>Kyiv City</span>, <span title='Postal Code'>03453</span><span class="located" title="Located!" /></li>

        <li><span title='Resolved IP address'>z.z.z.z</span></li>

        <li class="separator" />

        <li class="service">
          <a class="whois" href="https://whois.domaintools.com/furman.im"
            title="Open link in a new tab" target="_blank">
            Whois
          </a>
        </li>`)
    })

    it('renders geo data', () => {
      r = regular({
        domain: 'geo.furman.im',
        ip: 'yyy.yyy.yyy.yyy',
        country_name: 'Romania',
        postal_code: '88014'
      })

      expect(r).htmll.to.equal(`
        <li class="header"><span title='Country'>Romania</span></li>
        <li>
          <span title='Postal Code'>88014</span></li>

        <li><span title='Resolved IP address'>yyy.yyy.yyy.yyy</span></li>

        <li class="separator" />

        <li class="service">
          <a class="whois" href="https://whois.domaintools.com/geo.furman.im"
            title="Open link in a new tab" target="_blank">
            Whois
          </a>
        </li>`)
    })

    it('does not explode without data', () => {
      // @ts-expect-error: templates spec
      r = regular({})

      expect(r).htmll.to.equal(`
        <li class="header"></li>
        <li></li>
        <li class="separator" />
        <li class="service">
          <a class="whois" href="https://whois.domaintools.com/"
            title="Open link in a new tab" target="_blank">
            Whois
          </a>
        </li>`)
    })
  })

  describe('toolbar.ejs', () => {
    it('renders reload button', () => {
      r = toolbar({ is_local: false, has_mark_button: false })

      expect(r).htmll.to.equal(`
        <li
          class="button reload animate"
          title="Click to refresh data&#10;&#10;To support 🇺🇦 Armed Forces of Ukraine&#10;Cmd/Win + Click"
        />`)
    })

    it('renders mark button', () => {
      r = toolbar({ is_local: false, has_mark_button: true })

      expect(r).htmll.to.equal(
        `<li
          class="button reload animate"
          title="Click to refresh data&#10;&#10;To support 🇺🇦 Armed Forces of Ukraine&#10;Cmd/Win + Click"
        />
        <li class="button marklocal" title="Mark domain as local" />`
      )
    })

    it('renders unmark button', () => {
      r = toolbar({ is_local: true, has_mark_button: true })

      expect(r).htmll.to.equal(
        `<li class="button marklocal marked" title="Unmark domain as local" />`
      )
    })

    it('does not explode and renders reload button without data', () => {
      // @ts-expect-error: templates spec
      r = toolbar({})

      expect(r).htmll.to.equal(`
        <li
          class="button reload animate"
          title="Click to refresh data&#10;&#10;To support 🇺🇦 Armed Forces of Ukraine&#10;Cmd/Win + Click"
        />`)
    })
  })
})
