import { expect } from 'chai'
import sinon, { SinonStub } from 'sinon'

import {
  isLocal,
  getDomain,
  storage,
  setAction,
  resolve
} from '../src/helpers.js'

const pickStub = <K extends keyof O, O>(key: K, obj: O) =>
  obj[key] as SinonStub<
    any[],
    O[K] extends (...args: any) => any ? Partial<ReturnType<O[K]>> : any
  >

describe('helpers.ts', () => {
  describe('isLocal', () => {
    // prettier-ignore
    const cases = [
      [true,  'localhost'],
      [true,  '0.0.0.0'],
      [false, '0.0.0.1'],

      [true,  '127.0.0.0'],
      [true,  '127.0.0.1'],
      [true,  '127.1.1.1'],

      [true,  '10.0.0.1'],
      [true,  '10.1.1.1'],
      [true,  '10.0.0.0'],

      [false, '172.15.0.0'],
      [true,  '172.16.0.0'],
      [true,  '172.16.100.0'],
      [true,  '172.31.0.0'],
      [true,  '172.31.0.0'],
      [false, '172.32.0.0'],

      [true,  '192.168.0.0'],
      [false, '192.169.0.0'],
      [false, '191.168.0.0'],

      [false, '0.0'],
      [false, undefined],
      [false, '123'],
      [false, '127.0.0.0.boop.com'],
      [false, '10.o.0.0.com'],
      [false, '8.8.8.8'],
      [false, 'geo.furman.im'],
      [false, 'battlestation'],
    ] as const

    cases.forEach(([expected, ip]) => {
      it(`${expected ? 'local' : 'global'}\t${ip}`, () => {
        expect(isLocal(ip)).to.equal(expected)
      })
    })
  })

  describe('getDomain', () => {
    it('returns domain for http, https and ftp schemas', () => {
      expect(getDomain('http://boop.doop')).to.eq('boop.doop')
      expect(
        getDomain('https://127.0.0.0.boop.com/welp?some=come&utm=sucks')
      ).to.eq('127.0.0.0.boop.com')
      expect(getDomain('ftp://scene')).to.eq('scene')
    })

    it('returns undefined for everything else', () => {
      expect(getDomain('')).to.be.undefined
      expect(getDomain(undefined)).to.be.undefined
      expect(getDomain('gopher://old')).to.be.undefined
      expect(getDomain('chrome://new-tab')).to.be.undefined
      expect(getDomain('magnet://h.a.s.h')).to.be.undefined
    })
  })

  describe('storage', () => {
    const setStub = pickStub('set', chrome.storage.local),
      getStub = pickStub('get', chrome.storage.local),
      clearStub = pickStub('clear', chrome.storage.local)

    it('#set', () => {
      storage.set('boop', { woop: 'shmloop' })

      expect(setStub).to.be.calledOnceWith({
        boop: { woop: 'shmloop' }
      })
    })

    it('#get', async () => {
      getStub.resolves({
        'a key': 'valooe',
        'another key': 'another valooe'
      })

      expect(await storage.get('but a key')).to.be.undefined
      expect(await storage.get('a key')).to.eq('valooe')
      expect(await storage.get('another key')).to.eq('another valooe')
    })

    it('clears itself when full and sets the data', async () => {
      setStub.onFirstCall().throws('im full')
      setStub.onSecondCall().resolves()

      await storage.set('smol', 'but important')

      expect(clearStub).to.be.calledOnce
      expect(setStub).to.be.calledTwice
      expect(setStub.firstCall).to.be.calledWith({ smol: 'but important' })
      expect(setStub.secondCall).to.be.calledWith({ smol: 'but important' })
    })
  })

  describe('setAction', () => {
    it('sets page action title', async () => {
      await setAction(88, 'boop title', 'ignore me')

      expect(chrome.action.setTitle).to.be.calledOnceWith({
        tabId: 88,
        title: 'boop title'
      })
    })

    it('sets non-flag page action icon', async () => {
      await setAction(99, 'ignore me', 'not a flag.png')

      expect(chrome.action.setIcon).to.be.calledOnceWith({
        tabId: 99,
        path: 'not a flag.png'
      })
    })

    describe('Flags 🚩', () => {
      const createImageBitmapMock = pickStub('createImageBitmap', global)

      const {
        Context2dStub: { clearRect, drawImage, getImageData },
        fetchResultStub: { blob: imageBlob }
      } = globalStubs

      beforeEach(() => {
        imageBlob.resolves('🖼')
        getImageData.callsFake(() => '🖼 upscaled')
      })

      it('creates 64x64 canvas and 2d context', () => {
        sinon.spy(global, 'OffscreenCanvas')

        setAction(123, 'any', 'thing')

        expect(OffscreenCanvas).to.be.calledWith(64, 64)
        expect(OffscreenCanvas.prototype.getContext).to.be.calledWith('2d', {
          willReadFrequently: true
        })
      })

      it('upscales, centers and renders the flag', async () => {
        createImageBitmapMock.resolves({
          width: 16 * 4,
          height: 11 * 4
        })

        await setAction(14, 'Ukraine', '/img/flags/ua.png')

        expect(clearRect).to.be.calledOnceWith(0, 0, 64, 64)

        // upscale
        expect(createImageBitmapMock).to.be.calledOnceWith('🖼', {
          resizeQuality: 'pixelated',
          resizeWidth: 16 * 4,
          resizeHeight: 11 * 4
        })

        // center vertically
        expect(drawImage).to.be.calledOnceWith(
          { width: 16 * 4, height: 11 * 4 },
          0,
          10
        )

        // send to browser
        expect(chrome.action.setIcon).to.be.calledOnceWith({
          tabId: 14,
          imageData: { '64': '🖼 upscaled' }
        })
      })

      it('handles 🇳🇵 narrow flag', async () => {
        createImageBitmapMock.resolves({
          width: 9 * 4,
          height: 11 * 4
        })

        await setAction(14, 'Nepal', '/img/flags/np.png')

        expect(clearRect).to.be.calledOnceWith(0, 0, 64, 64)

        expect(createImageBitmapMock).to.be.calledOnceWith('🖼', {
          resizeQuality: 'pixelated',
          resizeWidth: 9 * 4,
          resizeHeight: 11 * 4
        })

        expect(drawImage).to.be.calledOnceWith(
          { width: 9 * 4, height: 11 * 4 },
          0,
          10
        )
      })
    })
  })

  describe('resolve', () => {
    const {
      fetchResultStub: { json, okStub }
    } = globalStubs

    describe('Google DoH', () => {
      it('returns undefined when network error', async () => {
        pickStub('fetch', global).throws('no network')

        expect(await resolve('boop.com')).to.be.undefined
      })

      it('returns undefined when http error', async () => {
        expect(await resolve('boop.com')).to.be.undefined
      })

      it('returns undefined when DoH errors out', async () => {
        okStub.returns(true)
        json.resolves({ Status: 88 })

        expect(await resolve('boop.com')).to.be.undefined
      })

      it('returns undefined when no Answer', async () => {
        okStub.returns(true)
        json.resolves({ Status: 0 })

        expect(await resolve('boop.com')).to.be.undefined
      })

      it('returns undefined when no Answer with type 1 (A record)', async () => {
        okStub.returns(true)
        json.resolves({ Status: 0, Answer: [{ type: 'not 1' }] })

        expect(await resolve('boop.com')).to.be.undefined
      })

      it('returns undefined when no data for Answer with type 1', async () => {
        okStub.returns(true)
        json.resolves({ Status: 0, Answer: [{ type: 1 }] })

        expect(await resolve('boop.com')).to.be.undefined
      })

      it('makes correct query', async () => {
        await resolve('boop.com')

        expect(fetch).to.be.calledOnceWith(
          'https://dns.google/resolve?type=1&name=boop.com'
        )
      })

      it('resolves ip', async () => {
        okStub.returns(true)
        json.resolves({
          Status: 0,
          Answer: [{ type: 1, data: '7.7.7.7' }]
        })

        expect(await resolve('boop.com')).to.eq('7.7.7.7')
      })
    })

    describe('Firefox dns.resolve', () => {
      before(() => {
        // @ts-expect-error: let's pretend we are in firefox
        chrome.dns = 'is there'
      })

      after(() => {
        // @ts-expect-error: stop pretending we are in firefox
        delete chrome.dns
      })

      const resolveMock = pickStub('resolve', browser.dns)

      it('resolves ip without fetch', async () => {
        resolveMock.resolves({ addresses: ['66.66.66.66'] })

        expect(await resolve('boop.com')).to.eq('66.66.66.66')
        expect(fetch).not.to.be.called
      })

      it('falls back to DoH when could not resolve', async () => {
        resolveMock.rejects('nope')
        await resolve('boop.com')

        expect(fetch).to.be.calledOnceWith(
          'https://dns.google/resolve?type=1&name=boop.com'
        )
      })
    })
  })
})
