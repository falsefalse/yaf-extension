import { expect } from 'chai'

import { getDohResponse, pickStub } from './setup.js'
import type { GeoResponse } from '../src/lib/types.js'

import setFlag from '../src/set_flag.js'

const TAB_ID = 88

const getStub = pickStub('get', chrome.storage.local)
const fetchStub = pickStub('fetch', global)

describe('set_flag.ts', () => {
  beforeEach(() => {
    getStub.resolves({})
  })

  describe('Page action disable', () => {
    afterEach(() => {
      expect(chrome.action.disable).to.be.calledOnceWith(TAB_ID)
    })

    it('disables page action if domain is not there', async () => {
      await setFlag({ id: TAB_ID })

      expect(chrome.action.setTitle).to.be.calledOnceWith({
        tabId: TAB_ID,
        title: '😴'
      })
    })

    it('disables page action if schema does not match', async () => {
      await setFlag({ id: TAB_ID, url: 'gopher://is.out.of.the.question' })

      expect(chrome.action.setTitle).to.be.calledOnceWith({
        tabId: TAB_ID,
        title: '😴'
      })
    })
  })

  describe('Errors', () => {
    it('Sets page action when data has error', async () => {
      getStub.resolves({
        'error.domain': {
          error: 'Fetch has failed',
          fetched_at: new Date().getTime()
        }
      })
      await setFlag({ id: TAB_ID, url: 'http://error.domain' })

      expect(chrome.action.setTitle).calledWith({
        tabId: TAB_ID,
        title: 'Error: Fetch has failed'
      })
      expect(chrome.action.setIcon).calledWith({
        tabId: TAB_ID,
        path: '/img/icon/32.png'
      })
    })
  })

  describe('Local IPs', () => {
    afterEach(() => {
      expect(chrome.action.enable).to.be.calledWith(TAB_ID)
    })

    it('does not fetch neither geo nor DoH for local domains', async () => {
      await setFlag({ id: TAB_ID, url: 'http://localhost' })
      expect(fetchStub).not.to.be.called

      await setFlag({ id: TAB_ID, url: 'https://0.0.0.0' })
      expect(fetchStub).not.to.be.called

      await setFlag({ id: TAB_ID, url: 'https://127.0.0.1' })
      expect(fetchStub).not.to.be.called
    })

    it('renders title and icon', async () => {
      await setFlag({ id: TAB_ID, url: 'https://127.0.0.1' })

      expect(chrome.action.setTitle).to.be.calledWith({
        tabId: TAB_ID,
        title: '127.0.0.1 is a local resource'
      })
      expect(chrome.action.setIcon).to.be.calledWith({
        tabId: TAB_ID,
        path: '/img/local_resource.png'
      })
    })

    describe('Resolved to local IP', () => {
      beforeEach(() => {
        fetchStub
          .withArgs('https://dns.google/resolve?type=1&name=imma.local.dev')
          .resolves({
            ok: true,
            json: () => Promise.resolve(getDohResponse('10.0.0.0'))
          })
          .withArgs('https://dns.google/resolve?type=1&name=so.am.i')
          .resolves({
            ok: true,
            json: () => Promise.resolve(getDohResponse('10.10.10.10'))
          })
      })

      it('does not fetch geo data', async () => {
        await setFlag({ id: TAB_ID, url: 'http://imma.local.dev' })

        expect(fetchStub.firstCall).to.be.calledWithMatch('imma.local.dev')
        expect(fetchStub).not.to.be.calledWithMatch('localhost:8080')
      })

      it('renders title and icon', async () => {
        await setFlag({ id: TAB_ID, url: 'http://so.am.i' })

        expect(chrome.action.setTitle).to.be.calledWith({
          tabId: TAB_ID,
          title: 'so.am.i is a local resource'
        })
        expect(chrome.action.setIcon).to.be.calledWith({
          tabId: TAB_ID,
          path: '/img/local_resource.png'
        })
      })
    })
  })

  it('resolves IP, geo data and renders the icon', async () => {
    fetchStub
      .withArgs('https://dns.google/resolve?type=1&name=proper.site.ua')
      .resolves({
        ok: true,
        json: () => Promise.resolve(getDohResponse('9.9.9.9'))
      })

    const geoData: GeoResponse = {
      country_code: 'UA',
      country_name: 'Ukraine',
      ip: '9.9.9.9', // server echoes IP back
      city: 'Boyarka',
      region: 'Kyiv Metro Area'
    }

    fetchStub.withArgs('http://localhost:8080/9.9.9.9').resolves({
      ok: true,
      json: () => Promise.resolve(geoData)
    })

    pickStub('getImageData', globalStubs.Context2dStub).returns('🇺🇦')

    await setFlag({ id: TAB_ID, url: 'http://proper.site.ua' })

    // resolve
    expect(fetchStub.firstCall).to.be.calledWithMatch('proper.site.ua')
    // geo lookup
    expect(fetchStub.secondCall).to.be.calledWithMatch('9.9.9.9')
    // load image
    expect(fetchStub.thirdCall).to.be.calledWithMatch('/img/flags/ua.png')

    expect(chrome.action.enable).to.be.calledOnceWith(TAB_ID)
    expect(chrome.action.setTitle).to.be.calledOnceWith({
      tabId: TAB_ID,
      title: 'Ukraine → Kyiv Metro Area → Boyarka'
    })
    expect(chrome.action.setIcon).to.be.calledOnceWith({
      tabId: TAB_ID,
      imageData: { '64': '🇺🇦' }
    })
  })
})
