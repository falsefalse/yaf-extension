import {
  dohUrl,
  fetchMock,
  geoUrl,
  getDohResponse,
  getGeoResponse,
  json,
  requested,
  respond
} from './setup'

import { setFlag } from '../src/set_flag'

const TAB_ID = 88
const NOW = new Date('2023-04-20T04:20:00.000Z')

const { setTitle, setIcon } = chrome.action
const { local } = chrome.storage

describe('set_flag.ts', () => {
  beforeAll(() => vi.useFakeTimers({ now: NOW, toFake: ['Date'] }))
  afterAll(() => vi.useRealTimers())

  it('does nothing if tabId is not there', async () => {
    await setFlag({})

    expect(setTitle).not.toHaveBeenCalled()
    expect(setIcon).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await local.get(null)).toEqual({})
  })

  describe('Internal browser page action', () => {
    it('if domain is not there', async () => {
      await setFlag({ id: TAB_ID })

      expect(setTitle).toHaveBeenCalledExactlyOnceWith({
        tabId: TAB_ID,
        title: 'Internal browser page'
      })
      expect(setIcon).toHaveBeenCalledExactlyOnceWith({
        tabId: TAB_ID,
        path: '/img/icon/32.png'
      })
    })

    it('if URL schema does not match', async () => {
      await setFlag({ id: TAB_ID, url: 'gopher://is.out.of.the.question' })

      expect(setTitle).toHaveBeenCalledExactlyOnceWith({
        tabId: TAB_ID,
        title: 'Internal browser page'
      })
      expect(setIcon).toHaveBeenCalledExactlyOnceWith({
        tabId: TAB_ID,
        path: '/img/icon/32.png'
      })
    })
  })

  describe('Errors', () => {
    it('sets page action when data has error', async () => {
      await local.set({
        'error.domain': {
          error: 'Errority error boop doop!',
          fetched_at: NOW.getTime()
        }
      })

      await setFlag({ id: TAB_ID, url: 'http://error.domain' })

      expect(setTitle).toHaveBeenCalledWith({
        tabId: TAB_ID,
        title: 'Error: Errority error boop doop!'
      })
      expect(setIcon).toHaveBeenCalledWith({
        tabId: TAB_ID,
        imageData: { 64: expect.any(ImageData) }
      })
    })

    it('falls back to domain resolution when IP was not resolved', async () => {
      await setFlag({ id: TAB_ID, url: 'https://could.not.resolve' })

      expect(requested()).toContain(dohUrl('could.not.resolve'))
      expect(requested()).toContain(geoUrl('could.not.resolve'))
    })

    it('sets request parameters', async () => {
      await setFlag({ id: TAB_ID, url: 'https://head.e.rs' })

      expect(fetchMock).toHaveBeenCalledWith(geoUrl('head.e.rs'), {
        headers: expect.any(Headers),
        credentials: 'omit',
        mode: 'cors',
        cache: 'no-store'
      })

      const call = fetchMock.mock.calls.find(
        ([url]) => url == geoUrl('head.e.rs')
      )
      const headers = new Headers(call?.[1]?.headers)

      expect(Object.fromEntries(headers)).toEqual({
        accept: 'application/json',
        'x-client-version': 'x.y.z'
      })
    })

    describe('Network and server errors', () => {
      it('uses error json if it can', async () => {
        respond(
          'json.error',
          () =>
            new Response(
              `{ "error": "say, domain wasn't resolved...", "ip": "x.x.x.x" }`,
              { status: 404 }
            )
        )

        await setFlag({ id: TAB_ID, url: 'https://json.error' })

        expect(await local.get('json.error')).toEqual({
          'json.error': {
            fetched_at: NOW.getTime(),
            is_local: false,
            status: 404,
            ip: 'x.x.x.x',
            error: "say, domain wasn't resolved..."
          }
        })
      })

      it('uses error text', async () => {
        respond(
          'text.error',
          () =>
            new Response('something went real wrong on the server', {
              status: 500
            })
        )

        await setFlag({ id: TAB_ID, url: 'https://text.error' })

        expect(await local.get('text.error')).toEqual({
          'text.error': {
            fetched_at: NOW.getTime(),
            is_local: false,
            status: 500,
            error: 'something went real wrong on the server'
          }
        })
      })

      it('handles failed to fetch error', async () => {
        respond('net.down', () => {
          throw new Error('oopsie network down')
        })

        await setFlag({ id: TAB_ID, url: 'https://net.down' })

        expect(await local.get('net.down')).toEqual({
          'net.down': {
            fetched_at: NOW.getTime(),
            is_local: false,
            error: 'oopsie network down'
          }
        })
      })

      it('returns unknown errors as is', async () => {
        respond('what.even.is.this', () => {
          throw 'not supposed to happen'
        })

        await setFlag({ id: TAB_ID, url: 'https://what.even.is.this' })

        expect(await local.get('what.even.is.this')).toEqual({
          'what.even.is.this': {
            fetched_at: NOW.getTime(),
            is_local: false,
            error: 'not supposed to happen'
          }
        })
      })
    })
  })

  describe('Local IPs', () => {
    it('does not fetch neither geo nor DoH for local domains', async () => {
      await setFlag({ id: TAB_ID, url: 'http://localhost' })
      await setFlag({ id: TAB_ID, url: 'https://0.0.0.0' })
      await setFlag({ id: TAB_ID, url: 'https://127.0.0.1' })
      await setFlag({ id: TAB_ID, url: 'https://100.101.102.103' })
      await setFlag({ id: TAB_ID, url: 'https://ma.chine.ts.net' })

      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('renders local resource title and icon', async () => {
      await setFlag({ id: TAB_ID, url: 'https://127.0.0.1' })

      expect(setTitle).toHaveBeenCalledWith({
        tabId: TAB_ID,
        title: '127.0.0.1 is a local resource'
      })
      expect(setIcon).toHaveBeenCalledWith({
        tabId: TAB_ID,
        path: '/img/local_resource.png'
      })
    })

    it('renders Tailscale node title and icon for tailnet IPs', async () => {
      await setFlag({ id: TAB_ID, url: 'https://100.101.102.103:8080' })

      expect(setTitle).toHaveBeenCalledWith({
        tabId: TAB_ID,
        title: '100.101.102.103 is a Tailscale node'
      })
      expect(setIcon).toHaveBeenCalledWith({
        tabId: TAB_ID,
        path: '/img/tailscale.png'
      })
      expect(await local.get('100.101.102.103')).toEqual({
        '100.101.102.103': {
          fetched_at: NOW.getTime(),
          is_local: true,
          is_tailscale: true,
          icon: '/img/tailscale.png'
        }
      })
    })

    it('does not fetch marked as local domains', async () => {
      await local.set({
        'marked.as.local': { fetched_at: NOW.getTime(), is_local: true }
      })

      await setFlag({ id: TAB_ID, url: 'https://marked.as.local' })

      expect(fetchMock).not.toHaveBeenCalled()
    })

    describe('Resolved to local IP', () => {
      beforeEach(() => {
        respond('imma.local.dev', json(getDohResponse('10.0.0.0')))
      })

      it('does not fetch geo data', async () => {
        await setFlag({ id: TAB_ID, url: 'http://imma.local.dev' })

        expect(requested()).toContain(dohUrl('imma.local.dev'))
        expect(requested()).not.toContain(geoUrl('10.0.0.0'))
      })

      it('renders local resource title and icon', async () => {
        await setFlag({ id: TAB_ID, url: 'http://imma.local.dev' })

        expect(setTitle).toHaveBeenCalledWith({
          tabId: TAB_ID,
          title: 'imma.local.dev is a local resource'
        })
        // after the sweep the local icon has to be the one that stays
        expect(setIcon).toHaveBeenLastCalledWith({
          tabId: TAB_ID,
          path: '/img/local_resource.png'
        })
      })
    })

    describe('Resolved to tailnet IP', () => {
      beforeEach(() => {
        respond('imma.tailnet.dev', json(getDohResponse('100.99.1.2')))
      })

      it('does not fetch geo data, renders Tailscale node title', async () => {
        await setFlag({ id: TAB_ID, url: 'http://imma.tailnet.dev' })

        expect(requested()).toContain(dohUrl('imma.tailnet.dev'))
        expect(requested()).not.toContain(geoUrl('100.99.1.2'))

        expect(setTitle).toHaveBeenCalledWith({
          tabId: TAB_ID,
          title: 'imma.tailnet.dev is a Tailscale node'
        })
        expect(await local.get('imma.tailnet.dev')).toEqual({
          'imma.tailnet.dev': {
            fetched_at: NOW.getTime(),
            ip: '100.99.1.2',
            is_local: true,
            is_tailscale: true,
            icon: '/img/tailscale.png'
          }
        })
      })
    })
  })

  describe('Caching and refetch', () => {
    const minute = (secondsOffset = 0) => (60 + secondsOffset) * 1000
    const day = (minutesOffset = 0) => 24 * (60 + minutesOffset) * minute()

    const minutesAgo = (secondsOffset = 0) =>
      NOW.getTime() - minute(secondsOffset)

    const dayAgo = (minutesOffset = 0) => NOW.getTime() - day(minutesOffset)

    const weekAgo = (daysOffset = 0) => NOW.getTime() - (7 + daysOffset) * day()

    const networkError = (fetched_at: number) => ({
      error: 'an error',
      fetched_at
    })

    const notFoundError = (fetched_at: number) => ({
      error: 'an error',
      status: 404,
      fetched_at
    })

    it('refetches network errors after a minute', async () => {
      await local.set({ 'no.network': networkError(minutesAgo(+1)) })

      await setFlag({ id: TAB_ID, url: 'http://no.network' })

      expect(requested()).toContain(dohUrl('no.network'))
      expect(requested()).toContain(geoUrl('no.network'))
    })

    it("doesn't refetch network errors until minute has passed", async () => {
      await local.set({ 'no.network': networkError(minutesAgo(-1)) })

      await setFlag({ id: TAB_ID, url: 'http://no.network' })

      expect(requested()).not.toContain(dohUrl('no.network'))
      expect(requested()).not.toContain(geoUrl('no.network'))
    })

    it('refetches not founds after a day', async () => {
      await local.set({ 'not.found': notFoundError(dayAgo(+1)) })

      await setFlag({ id: TAB_ID, url: 'http://not.found' })

      expect(requested()).toContain(dohUrl('not.found'))
      expect(requested()).toContain(geoUrl('not.found'))
    })

    it("doesn't refetch not founds until a day has passed", async () => {
      await local.set({ 'not.found': notFoundError(dayAgo(-1)) })

      await setFlag({ id: TAB_ID, url: 'http://not.found' })

      expect(requested()).not.toContain(dohUrl('not.found'))
      expect(requested()).not.toContain(geoUrl('not.found'))
    })

    it('refetches the data if asked to', async () => {
      await local.set({
        'found.domain': {
          fetched_at: NOW.getTime(),
          ...getGeoResponse('x.x.x.x')
        }
      })

      await setFlag(
        { id: TAB_ID, url: 'http://found.domain' },
        { refetch: true }
      )

      expect(requested()).toContain(dohUrl('found.domain'))
      expect(requested()).toContain(geoUrl('found.domain'))
    })

    it('refetches data older than a week', async () => {
      await local.set({
        'eight.days.old': {
          fetched_at: weekAgo(+1),
          ...getGeoResponse('x.x.x.x')
        }
      })

      await setFlag({ id: TAB_ID, url: 'http://eight.days.old' })

      expect(requested()).toContain(dohUrl('eight.days.old'))
      expect(requested()).toContain(geoUrl('eight.days.old'))
    })

    it("doesn't refetch until a week has passed", async () => {
      await local.set({
        'six.days.old': {
          fetched_at: weekAgo(-1),
          ...getGeoResponse('x.x.x.x')
        }
      })

      await setFlag({ id: TAB_ID, url: 'http://six.days.old' })

      expect(requested()).not.toContain(dohUrl('six.days.old'))
      expect(requested()).not.toContain(geoUrl('six.days.old'))
      // the flag is still drawn from the cached data
      expect(requested()).toContain('/img/flags/ua.png')
    })
  })

  it('leaves the page action loading when there is nothing to render', async () => {
    respond(geoUrl('empty.response'), json({}))

    await setFlag({ id: TAB_ID, url: 'http://empty.response' })

    // the title staying at 'Resolving' is what says nothing rendered over the
    // sweep, the icon below only says a frame of it was the last thing drawn
    expect(setTitle).toHaveBeenCalledExactlyOnceWith({
      tabId: TAB_ID,
      title: 'Resolving empty.response …'
    })
    expect(setIcon).toHaveBeenLastCalledWith({
      tabId: TAB_ID,
      imageData: { 64: expect.any(ImageData) }
    })
    expect(await local.get('empty.response')).toEqual({
      'empty.response': { fetched_at: NOW.getTime(), is_local: false }
    })
  })

  it('resolves IP, fetches geo data and renders the flag', async () => {
    respond('proper.site.ua', json(getDohResponse('9.9.9.9')))
    respond('9.9.9.9', json(getGeoResponse('9.9.9.9')))

    await setFlag({ id: TAB_ID, url: 'http://proper.site.ua' })

    // resolve, look up, load image
    expect(requested()).toContain(dohUrl('proper.site.ua'))
    expect(requested()).toContain(geoUrl('9.9.9.9'))
    expect(requested()).toContain('/img/flags/ua.png')

    expect(setTitle).toHaveBeenCalledWith({
      tabId: TAB_ID,
      title: 'Resolving proper.site.ua …'
    })
    expect(setTitle).toHaveBeenCalledWith({
      tabId: TAB_ID,
      title: 'Ukraine → Kyiv Metro Area → Boyarka'
    })
    expect(setIcon).toHaveBeenCalledWith({
      tabId: TAB_ID,
      imageData: { 64: expect.any(ImageData) }
    })

    expect(await local.get('proper.site.ua')).toEqual({
      'proper.site.ua': {
        fetched_at: NOW.getTime(),
        is_local: false,
        ...getGeoResponse('9.9.9.9'),
        icon: '/img/flags/ua.png'
      }
    })
  })

  describe('Racing events', () => {
    const geoRequests = () =>
      requested().filter(url => url == geoUrl('9.9.9.9'))

    // starting a sweep decodes the base icon, an unseen domain has the default
    const sweeps = () => requested().filter(url => url == '/img/icon/32.png')

    it('looks up once when two events race for the same domain', async () => {
      respond('twice.at.once', json(getDohResponse('9.9.9.9')))
      respond('9.9.9.9', json(getGeoResponse('9.9.9.9')))

      // both tabs.onUpdated events of one navigation, neither has saved yet
      const [first, second] = await Promise.all([
        setFlag({ id: TAB_ID, url: 'http://twice.at.once' }),
        setFlag({ id: TAB_ID, url: 'http://twice.at.once' })
      ])

      expect(geoRequests()).toHaveLength(1)
      expect(sweeps()).toHaveLength(1)
      expect(first).toEqual(second)
    })

    it('lets the next lookup through once the first has landed', async () => {
      respond('again.and.again', json(getDohResponse('9.9.9.9')))
      respond('9.9.9.9', json(getGeoResponse('9.9.9.9')))

      const tab = { id: TAB_ID, url: 'http://again.and.again' }
      await setFlag(tab)
      await setFlag(tab, { refetch: true })

      expect(geoRequests()).toHaveLength(2)
    })
  })
})
