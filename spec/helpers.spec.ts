import { SinonStub } from 'sinon'
import { expect } from 'chai'

import { isLocal, getDomain, storage, setAction } from '../src/helpers.js'

const pickStub = <K extends keyof O, O>(key: K, obj: O) => obj[key] as SinonStub

describe('helpers.ts', () => {
  it('creates 64x64 canvas and 2d context', () => {
    const {
      OffscreenCanvas,
      OffscreenCanvas: {
        prototype: { getContext }
      }
    } = global

    expect(OffscreenCanvas).to.be.calledOnceWith(64, 64)
    expect(getContext).to.be.calledOnceWith('2d', {
      willReadFrequently: true
    })
  })

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
    const setStub = pickStub('set', global.chrome.storage.local),
      getStub = pickStub('get', global.chrome.storage.local),
      clearStub = pickStub('clear', global.chrome.storage.local)

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

    it('clears itself when full', async () => {
      setStub.throws('anything')

      await storage.set('smol', 'but fatal')

      expect(clearStub).to.be.calledOnce
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
      let drawImageMock: SinonStub
      let clearRectMock: SinonStub

      before(() => {
        const ctxMock = new OffscreenCanvas(1, 2).getContext('2d')!

        clearRectMock = pickStub('clearRect', ctxMock)
        drawImageMock = pickStub('drawImage', ctxMock)
        pickStub('getImageData', ctxMock).callsFake(() => '🖼 upscaled')
      })

      it('upscales, centers and renders the flag', async () => {
        createImageBitmapMock.callsFake(() => ({
          this: 'is a bitmap!',
          width: 16 * 4,
          height: 11 * 4
        }))

        await setAction(14, 'Ukraine', '/img/flags/ua.png')

        expect(clearRectMock).to.be.calledOnceWith(0, 0, 64, 64)

        // upscale
        expect(createImageBitmapMock).to.be.calledOnceWith('🖼', {
          resizeQuality: 'pixelated',
          resizeWidth: 16 * 4,
          resizeHeight: 11 * 4
        })

        // center vertically
        expect(drawImageMock).to.be.calledOnceWith(
          { this: 'is a bitmap!', width: 16 * 4, height: 11 * 4 },
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
        createImageBitmapMock.callsFake(() => ({
          this: 'is flag of Nepal',
          width: 9 * 4,
          height: 11 * 4
        }))

        await setAction(14, 'Nepal', '/img/flags/np.png')

        expect(clearRectMock).to.be.calledOnceWith(0, 0, 64, 64)

        expect(createImageBitmapMock).to.be.calledOnceWith('🖼', {
          resizeQuality: 'pixelated',
          resizeWidth: 9 * 4,
          resizeHeight: 11 * 4
        })

        expect(drawImageMock).to.be.calledOnceWith(
          { this: 'is flag of Nepal', width: 9 * 4, height: 11 * 4 },
          0,
          10
        )
      })
    })
  })
})
