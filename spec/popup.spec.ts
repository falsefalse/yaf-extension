import popupHtml from '../src/popup.html?raw'
import {
  currentTab,
  dohUrl,
  geoUrl,
  getGeoResponse,
  json,
  requested,
  respond,
  tab
} from './setup.js'

import '../src/popup.js'

const get = (selector: string) => document.querySelector(selector)
const texts = (selector: string) =>
  Array.from(document.querySelectorAll(selector), el => el.textContent?.trim())
const click = (el: Element | null, init: MouseEventInit = {}) =>
  el?.dispatchEvent(new MouseEvent('click', { bubbles: true, ...init }))

// popup.ts kicks off on DOMContentLoaded and nothing awaits the handler, wait for the outcome
const domReady = (outcome: () => unknown) => {
  window.dispatchEvent(new Event('DOMContentLoaded'))
  return vi.waitFor(outcome)
}

const NOW = new Date('2023-04-20T04:20:00.000Z')
const { body } = new DOMParser().parseFromString(popupHtml, 'text/html')

describe('popup.ts', () => {
  const close = vi.spyOn(window, 'close')
  const open = vi.spyOn(window, 'open')

  beforeAll(() =>
    vi.useFakeTimers({ now: NOW, toFake: ['Date', 'setTimeout'] })
  )
  afterAll(() => vi.useRealTimers())

  beforeEach(() => {
    document.body.innerHTML = body.innerHTML
    close.mockImplementation(() => {})
    open.mockImplementation(() => null)
  })

  it('closes popup if there is no tab', async () => {
    await domReady(() => expect(close).toHaveBeenCalledOnce())
  })

  it('does not try to render into empty DOM', async () => {
    document.body.innerHTML = '<nope>nothing</nope>'
    currentTab({ id: 99, url: 'http://something' })
    respond('something', json({ error: 'nope' }))

    // icons come last in a page action, 🔵 while resolving and 🔴 for the error,
    // nothing is awaited after them so the handler is through once both are set
    await domReady(() => expect(chrome.action.setIcon).toHaveBeenCalledTimes(2))

    expect(chrome.action.setTitle).toHaveBeenCalledWith({
      tabId: 99,
      title: 'Error: nope'
    })
    expect(document.body.innerHTML).toBe('<nope>nothing</nope>')
    expect(close).not.toHaveBeenCalled()
  })

  it('closes popup if tab has no id', async () => {
    currentTab({ url: 'http://no.tabid' })

    await domReady(() => expect(close).toHaveBeenCalledOnce())
  })

  it('closes popup and disables page action if URL is wronk', async () => {
    currentTab({ id: 99, url: 'wronk://url' })

    await domReady(() => expect(close).toHaveBeenCalledOnce())
    expect(chrome.action.disable).toHaveBeenCalledExactlyOnceWith(99)
  })

  describe('Reload button', () => {
    beforeEach(async () => {
      currentTab({ id: 88, url: 'http://furman.im' })
      await chrome.storage.local.set({
        'furman.im': { fetched_at: NOW.getTime(), ...getGeoResponse('z.z.z.z') }
      })
    })

    it('fetches new data when reload clicked', async () => {
      await domReady(() => expect(get('.header')).toHaveTextContent('Ukraine'))
      expect(requested()).toContain('/img/flags/ua.png')

      click(get('.button.reload'))

      // requests go out mid-flight, the popup is done only once loading is over
      expect(document.body).toHaveClass('is-loading')
      await vi.waitFor(() =>
        expect(document.body).not.toHaveClass('is-loading')
      )

      expect(requested()).toContain(dohUrl('furman.im'))
      expect(requested()).toContain(geoUrl('furman.im'))
    })

    it('opens donation link when reload is meta+clicked', async () => {
      await domReady(() => expect(get('.header')).toHaveTextContent('Ukraine'))

      click(get('.button.reload'), { metaKey: true })

      expect(open).toHaveBeenCalledExactlyOnceWith(
        'https://savelife.in.ua/en/donate-en/#donate-army-card-once',
        '_blank',
        'noopener,noreferrer'
      )
      expect(close).toHaveBeenCalledOnce()
    })
  })

  describe('Resolved', () => {
    it('renders geo data handsomely', async () => {
      currentTab({ id: 88, url: 'http://furman.im' })
      await chrome.storage.local.set({
        'furman.im': {
          fetched_at: NOW.getTime(),
          ...getGeoResponse('z.z.z.z', {
            city: 'Kyiv',
            region: 'Kyiv City',
            postal_code: '03453'
          })
        }
      })

      await domReady(() => expect(get('.header')).toHaveTextContent('Ukraine'))

      expect(get('.button.marklocal')).toBeNull()
      expect(get('.button.reload')).not.toBeNull()

      expect(texts('.result li:not(.service, .separator)')).toEqual([
        'Ukraine',
        'Kyiv, Kyiv City, 03453',
        'z.z.z.z'
      ])
      expect(get('.located')).not.toBeNull()

      expect(get('a.whois')).toHaveAttribute(
        'href',
        'https://whois.domaintools.com/furman.im'
      )
    })

    it('closes popup after whois link is clicked', async () => {
      currentTab({ id: 88, url: 'http://furman.im' })
      await chrome.storage.local.set({
        'furman.im': { fetched_at: NOW.getTime(), ...getGeoResponse('z.z.z.z') }
      })

      await domReady(() => expect(get('.header')).toHaveTextContent('Ukraine'))

      // keep the link from actually opening a tab
      window.addEventListener('click', event => event.preventDefault(), {
        once: true
      })
      click(get('a.whois'))

      // delayed so that firefox gets to open the link, see popup.ts
      expect(close).not.toHaveBeenCalled()
      vi.advanceTimersByTime(50)
      expect(close).toHaveBeenCalledOnce()
    })
  })

  it('does not render toolbar for local domains', async () => {
    currentTab({ id: 88, url: 'http://0.0.0.0' })

    await domReady(() =>
      expect(get('.header')).toHaveTextContent('Local resource')
    )

    expect(get('.toolbar')?.childElementCount).toBe(0)
    expect(texts('.result li')).toEqual(['Local resource', '0.0.0.0'])
  })

  it('does not render toolbar for domains resolved to local IPs', async () => {
    currentTab({ id: 88, url: 'http://resolved.local' })
    await chrome.storage.local.set({
      'resolved.local': {
        fetched_at: NOW.getTime(),
        ip: '10.x.x.x',
        is_local: true
      }
    })

    await domReady(() =>
      expect(get('.header')).toHaveTextContent('Local resource')
    )

    expect(get('.toolbar')?.childElementCount).toBe(0)
    expect(get('.resolved')).toHaveTextContent('10.x.x.x')
  })

  it('renders Tailscale node for tailnet IPs', async () => {
    currentTab({ id: 88, url: 'http://100.101.102.103' })

    await domReady(() =>
      expect(get('.header')).toHaveTextContent('Tailscale node')
    )

    expect(get('.toolbar')?.childElementCount).toBe(0)
    expect(texts('.result li')).toEqual(['Tailscale node', '100.101.102.103'])
    expect(requested()).toEqual([])
  })

  it('renders Tailscale node for domains resolved to tailnet IPs', async () => {
    currentTab({ id: 88, url: 'http://resolved.tailnet' })
    await chrome.storage.local.set({
      'resolved.tailnet': {
        fetched_at: NOW.getTime(),
        ip: '100.x.x.x',
        is_local: true,
        is_tailscale: true
      }
    })

    await domReady(() =>
      expect(get('.header')).toHaveTextContent('Tailscale node')
    )

    expect(get('.toolbar')?.childElementCount).toBe(0)
    expect(get('.resolved')).toHaveTextContent('100.x.x.x')
  })

  describe('Formatted hint', () => {
    const local = (fetched_at: Date) => ({
      fetched_at: fetched_at.getTime(),
      ip: '192.168.x.x',
      is_local: true
    })

    beforeEach(() => {
      currentTab({ id: 88, url: 'http://resolved.local' })
    })

    it('month ago', async () => {
      const lastMonth = new Date('2023-03-10T16:35:35.000Z')
      await chrome.storage.local.set({ 'resolved.local': local(lastMonth) })

      await domReady(() =>
        expect(get('.resolved')).toHaveTextContent('192.168.x.x')
      )

      // different ICU versions put different spaces before AM/PM
      const title = get('.resolved')?.getAttribute('title')
      expect(title).toContain('Resolved at 🕟 04:35')
      expect(title).toContain('PM last month')
    })

    it('week ago', async () => {
      const lastWeek = new Date('2023-04-10T16:25:35.000Z')
      await chrome.storage.local.set({ 'resolved.local': local(lastWeek) })

      await domReady(() =>
        expect(get('.resolved')).toHaveTextContent('192.168.x.x')
      )

      const title = get('.resolved')?.getAttribute('title')
      expect(title).toContain('Resolved at 🕓 04:25')
      expect(title).toContain('PM last week')
    })
  })

  it('allows to mark unresolved domain as local', async () => {
    currentTab({ id: 88, url: 'http://not.resolved' })
    await chrome.storage.local.set({
      'not.resolved': { error: 'not found this one', fetched_at: NOW.getTime() }
    })

    await domReady(() =>
      expect(get('.header')).toHaveTextContent('not.resolved')
    )
    expect(get('.button.marklocal')).toHaveAttribute(
      'title',
      'Mark domain as local'
    )

    click(get('.button.marklocal'))

    await vi.waitFor(() =>
      expect(get('.button.marklocal')).toHaveClass('marked')
    )
    expect(get('.button.marklocal')).toHaveAttribute(
      'title',
      'Unmark domain as local'
    )

    // flipped, error kept, local icon remembered
    expect(await chrome.storage.local.get('not.resolved')).toEqual({
      'not.resolved': {
        error: 'not found this one',
        fetched_at: NOW.getTime(),
        is_local: true,
        icon: '/img/local_resource.png'
      }
    })
    expect(requested()).not.toContain(dohUrl('not.resolved'))
    expect(requested()).not.toContain(geoUrl('not.resolved'))
  })

  it('closes popup instead of marking when tab url has become wronk', async () => {
    const current = tab({ id: 88, url: 'http://not.resolved' })
    vi.spyOn(chrome.tabs, 'query').mockImplementation(async () => [current])
    await chrome.storage.local.set({
      'not.resolved': { error: 'not found this one', fetched_at: NOW.getTime() }
    })

    await domReady(() =>
      expect(get('.header')).toHaveTextContent('not.resolved')
    )

    current.url = 'gopher://not.resolved'
    click(get('.button.marklocal'))

    await vi.waitFor(() => expect(close).toHaveBeenCalledOnce())
    expect(chrome.action.disable).toHaveBeenCalledExactlyOnceWith(88)
  })

  it('renders mark as local when domain is still not resolved after unmarking', async () => {
    currentTab({ id: 88, url: 'http://marked.as.local' })
    await chrome.storage.local.set({
      'marked.as.local': {
        fetched_at: NOW.getTime(),
        is_local: true,
        error: 'not resolved at first'
      }
    })
    respond('marked.as.local', json({ error: 'nope, not resolved still' }))

    await domReady(() =>
      expect(get('.header')).toHaveTextContent('Local resource')
    )
    expect(get('.button.marklocal')).toHaveClass('marked')
    expect(get('.button.marklocal')).toHaveAttribute(
      'title',
      'Unmark domain as local'
    )
    expect(texts('.result li')).toEqual(['Local resource', 'marked.as.local'])

    click(get('.button.marklocal'))

    await vi.waitFor(() =>
      expect(get('.header')).toHaveTextContent('marked.as.local')
    )
    expect(requested()).toContain(dohUrl('marked.as.local'))
    expect(requested()).toContain(geoUrl('marked.as.local'))

    expect(texts('.result li')).toEqual([
      'marked.as.local',
      'nope, not resolved still'
    ])
    expect(get('.button.marklocal')).not.toHaveClass('marked')
    expect(get('.button.marklocal')).toHaveAttribute(
      'title',
      'Mark domain as local'
    )
  })

  it('hides mark button when domain resolves after unmarking', async () => {
    currentTab({ id: 88, url: 'http://unresolved.at.first' })
    await chrome.storage.local.set({
      'unresolved.at.first': {
        fetched_at: NOW.getTime(),
        is_local: true,
        error: 'not resolved at first'
      }
    })
    respond(geoUrl('unresolved.at.first'), json(getGeoResponse('x.x.x.x')))

    await domReady(() =>
      expect(get('.header')).toHaveTextContent('Local resource')
    )
    expect(get('.button.marklocal')).toHaveClass('marked')
    expect(texts('.result li')).toEqual([
      'Local resource',
      'unresolved.at.first'
    ])

    click(get('.button.marklocal'))

    await vi.waitFor(() => expect(get('.header')).toHaveTextContent('Ukraine'))
    expect(requested()).toContain(dohUrl('unresolved.at.first'))
    expect(requested()).toContain(geoUrl('unresolved.at.first'))

    expect(texts('.result li:not(.separator)')).toEqual([
      'Ukraine',
      'Boyarka, Kyiv Metro Area',
      'x.x.x.x',
      'Whois'
    ])
    expect(get('.button.marklocal')).toBeNull()
  })

  it('renders only the toolbar when there is nothing to render', async () => {
    currentTab({ id: 88, url: 'http://nothing.to.show' })
    await chrome.storage.local.set({
      'nothing.to.show': { fetched_at: NOW.getTime(), is_local: false }
    })

    await domReady(() => expect(get('.button.reload')).not.toBeNull())

    expect(get('.header')).toHaveTextContent('Loading...')
  })

  it('keeps the popup as is when tab url has become wronk on reload', async () => {
    const current = tab({ id: 88, url: 'http://furman.im' })
    vi.spyOn(chrome.tabs, 'query').mockImplementation(async () => [current])
    await chrome.storage.local.set({
      'furman.im': { fetched_at: NOW.getTime(), ...getGeoResponse('z.z.z.z') }
    })

    await domReady(() => expect(get('.header')).toHaveTextContent('Ukraine'))

    current.url = 'gopher://furman.im'
    click(get('.button.reload'))

    expect(document.body).toHaveClass('is-loading')
    await vi.waitFor(() => expect(document.body).not.toHaveClass('is-loading'))

    expect(chrome.action.disable).toHaveBeenCalledExactlyOnceWith(88)
    expect(get('.header')).toHaveTextContent('Ukraine')
  })

  describe('Donation animation', () => {
    beforeEach(async () => {
      currentTab({ id: 88, url: 'http://furman.im' })
      await chrome.storage.local.set({
        'furman.im': { fetched_at: NOW.getTime(), ...getGeoResponse('z.z.z.z') }
      })
    })

    it('animates for 2s when dice rolls less than 1/16', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(1 / 17)

      await domReady(() => expect(get('.rotator')).not.toBeNull())
      expect(
        document.documentElement.style.getPropertyValue('--js-rotator-duration')
      ).toBe('2000ms')

      vi.advanceTimersByTime(2000)
      expect(get('.rotator')).toBeNull()
    })

    it('does not animate when dice rolls more than 1/16', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(1)

      await domReady(() => expect(get('.header')).toHaveTextContent('Ukraine'))
      expect(get('.rotator')).toBeNull()
    })
  })
})
