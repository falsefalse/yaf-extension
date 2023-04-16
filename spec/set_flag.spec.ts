import sinon, { type SinonFakeTimers } from 'sinon'
import { expect } from 'chai'

import { getDohResponse, getGeoResponse, pickStub } from './setup.js'

import setFlag from '../src/set_flag.js'

const TAB_ID = 88
const NOW = new Date('2023-04-20T04:20:00.000Z')

const getStub = pickStub('get', chrome.storage.local)
const setStub = pickStub('set', chrome.storage.local)
const fetchStub = pickStub('fetch', global)

describe('set_flag.ts', () => {
  let clock: SinonFakeTimers

  before(() => {
    clock = sinon.useFakeTimers({ now: NOW, toFake: ['Date'] })
  })

  after(() => {
    clock.restore()
  })

  it('does nothing if tabId is not there', async () => {
    await setFlag({})

    expect(chrome.action.setTitle).not.called
    expect(chrome.action.setIcon).not.called
    expect(fetch).not.called
    expect(getStub).not.called
    expect(setStub).not.called
  })

  describe('Disable page action', () => {
    afterEach(() => {
      expect(chrome.action.disable).calledOnceWith(TAB_ID)
    })

    it('if domain is not there', async () => {
      await setFlag({ id: TAB_ID })

      expect(chrome.action.setTitle).calledOnceWith({
        tabId: TAB_ID,
        title: '😴'
      })
    })

    it('if URL schema does not match', async () => {
      await setFlag({ id: TAB_ID, url: 'gopher://is.out.of.the.question' })

      expect(chrome.action.setTitle).calledOnceWith({
        tabId: TAB_ID,
        title: '😴'
      })
    })
  })

  describe('Errors', () => {
    it('sets page action when data has error', async () => {
      getStub.resolves({
        'error.domain': {
          error: 'Errority error boop doop!',
          fetched_at: NOW.getTime()
        }
      })
      await setFlag({ id: TAB_ID, url: 'http://error.domain' })

      expect(chrome.action.setTitle).calledWith({
        tabId: TAB_ID,
        title: 'Error: Errority error boop doop!'
      })
      expect(chrome.action.setIcon).calledWith({
        tabId: TAB_ID,
        imageData: { 64: sinon.match.any }
      })
    })

    it('falls back to domain resolution when IP was not resolved', async () => {
      fetchResultStub.ok = false

      await setFlag({ id: TAB_ID, url: 'https://could.not.resolve' })

      // first call is DoH
      expect(fetchStub).calledWith(
        sinon.match('localhost:8080').and(sinon.match('could.not.resolve'))
      )
    })
    it('sets request parameters', async () => {
      await setFlag({ id: TAB_ID, url: 'https://head.e.rs' })

      // first call is DoH
      expect(fetchStub).calledWith(sinon.match('head.e.rs'), {
        headers: {
          Accept: 'application/json',
          'x-client-version': sinon.match.string
        },
        credentials: 'omit',
        mode: 'cors'
      })
    })

    describe('Network and server errors', () => {
      it('uses error json if it can', async () => {
        fetchResultStub.ok = false
        fetchResultStub.status = 404
        fetchResultStub.text.resolves(
          `{ "error": "say, domain wasn't resolved...",
                 "ip": "x.x.x.x" }`
        )

        await setFlag({ id: TAB_ID, url: 'https://json.error' })

        expect(setStub).calledWith({
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
        fetchResultStub.ok = false
        fetchResultStub.status = 500
        fetchResultStub.text.resolves('something went real wrong on the server')

        await setFlag({ id: TAB_ID, url: 'https://text.error' })

        expect(setStub).calledWith({
          'text.error': {
            fetched_at: NOW.getTime(),
            is_local: false,
            status: 500,
            error: 'something went real wrong on the server'
          }
        })
      })

      it('handles failed to fetch error', async () => {
        fetchStub
          .withArgs(sinon.match('net.down'))
          .throws(new Error('oopsie network down'))

        await setFlag({ id: TAB_ID, url: 'https://net.down' })

        expect(setStub).calledWith({
          'net.down': {
            fetched_at: NOW.getTime(),
            is_local: false,
            error: 'oopsie network down'
          }
        })
      })

      it('returns unknown errors as is', async () => {
        fetchStub.withArgs(sinon.match('what.even.is.this')).callsFake(() => {
          throw 'not supposed to happen'
        })

        await setFlag({ id: TAB_ID, url: 'https://what.even.is.this' })

        expect(setStub).calledWith({
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
    afterEach(() => {
      expect(chrome.action.enable).calledWith(TAB_ID)
    })

    it('does not fetch neither geo nor DoH for local domains', async () => {
      await setFlag({ id: TAB_ID, url: 'http://localhost' })
      expect(fetchStub).not.called

      await setFlag({ id: TAB_ID, url: 'https://0.0.0.0' })
      expect(fetchStub).not.called

      await setFlag({ id: TAB_ID, url: 'https://127.0.0.1' })
      expect(fetchStub).not.called
    })

    it('renders local resource title and icon', async () => {
      await setFlag({ id: TAB_ID, url: 'https://127.0.0.1' })

      expect(chrome.action.setTitle).calledWith({
        tabId: TAB_ID,
        title: '127.0.0.1 is a local resource'
      })
      expect(chrome.action.setIcon).calledWith({
        tabId: TAB_ID,
        path: '/img/local_resource.png'
      })
    })

    it('does not fetch marked as local domains', async () => {
      getStub.resolves({
        'marked.as.local': {
          fetched_at: NOW.getTime(),
          is_local: true
        }
      })

      await setFlag({ id: TAB_ID, url: 'https://marked.as.local' })

      expect(fetchStub).not.called
    })

    describe('Resolved to local IP', () => {
      beforeEach(() => {
        fetchStub.withArgs(sinon.match('imma.local.dev')).resolves({
          ok: true,
          json: () => Promise.resolve(getDohResponse('10.0.0.0'))
        })
      })

      it('does not fetch geo data', async () => {
        await setFlag({ id: TAB_ID, url: 'http://imma.local.dev' })

        expect(fetchStub).calledWith(
          sinon.match('dns.google').and(sinon.match('imma.local.dev'))
        )
        expect(fetchStub).not.calledWith(
          sinon.match('localhost:8080').and(sinon.match('10.0.0.0'))
        )
      })

      it('renders local resource title and icon', async () => {
        await setFlag({ id: TAB_ID, url: 'http://imma.local.dev' })

        expect(chrome.action.setTitle).calledWith({
          tabId: TAB_ID,
          title: 'imma.local.dev is a local resource'
        })
        expect(chrome.action.setIcon).calledWith({
          tabId: TAB_ID,
          path: '/img/local_resource.png'
        })
      })
    })
  })

  describe('Caching and refetch', () => {
    const minute = (secondsOffset = 0) => (60 + secondsOffset) * 1000
    const day = (minutesOffset = 0) => 24 * (60 + minutesOffset) * minute()

    const minutesAgo = (secondsOffset = 0) =>
      new Date(NOW.getTime() - minute(secondsOffset)).getTime()

    const dayAgo = (minutesOffset = 0) =>
      new Date(NOW.getTime() - day(minutesOffset)).getTime()

    const weekAgo = (daysOffset = 0) =>
      new Date(NOW.getTime() - (7 + daysOffset) * day()).getTime()

    const networkError = (domain: string, fetched_at: number) => ({
      [domain]: {
        error: 'an error',
        fetched_at
      }
    })

    const notFoundErorr = (domain: string, fetched_at: number) => ({
      [domain]: {
        error: 'an error',
        status: 404,
        fetched_at
      }
    })

    it('refetches network errors after a minute', async () => {
      const moreThanMinuteAgo = minutesAgo(+1)
      getStub.resolves(networkError('no.network', moreThanMinuteAgo))

      await setFlag({ id: TAB_ID, url: 'http://no.network' })

      expect(fetchStub)
        .calledWith(sinon.match('dns.google').and(sinon.match('no.network')))
        .calledWith(
          sinon.match('localhost:8080').and(sinon.match('no.network'))
        )
    })

    it("doesn't refetch network errors until minute has passed", async () => {
      const lessThanMinuteAgo = minutesAgo(-1)
      getStub
        .withArgs(sinon.match('no.network'))
        .resolves(networkError('no.network', lessThanMinuteAgo))

      await setFlag({ id: TAB_ID, url: 'http://no.network' })

      expect(fetchStub)
        .not.calledWith(sinon.match('dns.google').and(sinon.match('not.found')))
        .not.calledWith(
          sinon.match('localhost:8080').and(sinon.match('not.found'))
        )
    })

    it('refetches not founds after a day', async () => {
      const moreThanDayAgo = dayAgo(+1)
      getStub
        .withArgs(sinon.match('not.found'))
        .resolves(notFoundErorr('not.found', moreThanDayAgo))

      await setFlag({ id: TAB_ID, url: 'http://not.found' })

      expect(fetchStub)
        .calledWith(sinon.match('dns.google').and(sinon.match('not.found')))
        .calledWith(sinon.match('localhost:8080').and(sinon.match('not.found')))
    })

    it("doesn't refetch not founds until a day has passed", async () => {
      const lessThanDayAgo = dayAgo(-1)
      getStub
        .withArgs(sinon.match('not.found'))
        .resolves(notFoundErorr('not.found', lessThanDayAgo))

      await setFlag({ id: TAB_ID, url: 'http://not.found' })

      expect(fetchStub)
        .not.calledWith(sinon.match('dns.google').and(sinon.match('not.found')))
        .not.calledWith(
          sinon.match('localhost:8080').and(sinon.match('not.found'))
        )
    })

    it('refetches the data if asked to', async () => {
      getStub.resolves({
        'found.domain': {
          fetched_at: NOW.getTime(),
          country_code: 'space'
        }
      })

      await setFlag(
        { id: TAB_ID, url: 'http://found.domain' },
        { refetch: true }
      )

      expect(fetchStub)
        .calledWith(sinon.match('dns.google').and(sinon.match('found.domain')))
        .calledWith(
          sinon.match('localhost:8080').and(sinon.match('found.domain'))
        )
    })

    it('refetches data older than a week', async () => {
      const moreThanWeekAgo = weekAgo(+1)
      getStub.resolves({
        'eight.days.old': {
          fetched_at: moreThanWeekAgo,
          country_code: 'deep past'
        }
      })

      await setFlag({ id: TAB_ID, url: 'http://eight.days.old' })

      expect(fetchStub)
        .calledWith(
          sinon.match('dns.google').and(sinon.match('eight.days.old'))
        )
        .calledWith(
          sinon.match('localhost:8080').and(sinon.match('eight.days.old'))
        )
    })

    it("doesn't refetch until a week has passed", async () => {
      const lessThanWeekAgo = weekAgo(-1)
      getStub.resolves({
        'six.days.old': {
          fetched_at: lessThanWeekAgo,
          country_code: 'not so deep past'
        }
      })

      await setFlag({ id: TAB_ID, url: 'http://six.days.old' })

      // `not.called` won't do, it will `fetch` image blob from disk
      expect(fetchStub)
        .not.calledWithMatch('dns.google')
        .not.calledWithMatch('localhost:8080')
    })
  })

  it('resolves IP, fetches geo data and renders the flag', async () => {
    fetchStub.withArgs(sinon.match('proper.site.ua')).resolves({
      ok: true,
      json: () => Promise.resolve(getDohResponse('9.9.9.9'))
    })

    fetchStub.withArgs(sinon.match('9.9.9.9')).resolves({
      ok: true,
      json: () => Promise.resolve(getGeoResponse('9.9.9.9'))
    })

    pickStub('getImageData', Context2dStub).returns('🇺🇦')

    await setFlag({ id: TAB_ID, url: 'http://proper.site.ua' })

    // resolve
    expect(fetchStub).calledWithMatch('proper.site.ua')
    // geo lookup
    expect(fetchStub).calledWithMatch('9.9.9.9')
    // load image
    expect(fetchStub).calledWithMatch('/img/flags/ua.png')

    expect(chrome.action.enable).calledOnceWith(TAB_ID)
    expect(chrome.action.setTitle).calledWith({
      tabId: TAB_ID,
      title: 'Resolving proper.site.ua …'
    })
    expect(chrome.action.setTitle).calledWith({
      tabId: TAB_ID,
      title: 'Ukraine → Kyiv Metro Area → Boyarka'
    })
    expect(chrome.action.setIcon).calledWith({
      tabId: TAB_ID,
      imageData: { '64': '🇺🇦' }
    })
  })
})
