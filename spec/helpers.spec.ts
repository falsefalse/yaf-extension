import sinon from 'sinon'
import { expect } from 'chai'

import { getDohResponse, getGeoResponse, pickStub } from './setup.js'

import {
  isLocal,
  getDomain,
  storage,
  setPageAction,
  resolve,
  SquareCanvas
} from '../src/helpers.js'

const TAB_ID = 14

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
      [false, '172.32.0.0'],

      [true,  '192.168.0.0'],
      [false, '192.169.0.0'],
      [false, '191.168.0.0'],

      [false, '0.0'],
      [false, '....'],
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
      storage.saveDomain('boop', {
        fetched_at: 777,
        ip: 'b.b.b.b',
        is_local: true
      })

      expect(setStub).calledOnceWith({
        boop: { fetched_at: 777, ip: 'b.b.b.b', is_local: true }
      })
    })

    it('#get', async () => {
      getStub.resolves({
        'a key': 'valooe',
        'another key': 'another valooe'
      })

      expect(await storage.getDomain('but a key')).to.be.undefined
      expect(await storage.getDomain('a key')).to.eq('valooe')
      expect(await storage.getDomain('another key')).to.eq('another valooe')
    })

    it('#get returned undefined', async () => {
      getStub.resolves(undefined)

      expect(await storage.getDomain('should not throw')).to.be.undefined
    })

    it('clears itself when full and sets the data', async () => {
      setStub.onFirstCall().throws()
      setStub.onSecondCall().resolves()

      const data = {
        fetched_at: 1,
        error: 'smol but important',
        is_local: false
      }

      await storage.saveDomain('smol', data)

      expect(clearStub).calledOnce
      expect(setStub).calledTwice
      expect(setStub.firstCall).calledWith({ smol: data })
      expect(setStub.secondCall).calledWith({ smol: data })
    })
  })

  describe('setPageAction', () => {
    const actionBox = sinon.createSandbox({ properties: ['spy'] })

    const saveIconSpy = actionBox.spy(storage, 'saveDomainIcon')
    const drawSpy = actionBox.spy(SquareCanvas.prototype, 'drawUpscaled')
    const glyphSpy = actionBox.spy(SquareCanvas.prototype, 'addGlyph' as any)
    const blurSpy = actionBox.spy(SquareCanvas.prototype, 'blur' as any)

    afterEach(() => {
      actionBox.reset()
    })

    it('sets local domain action icon and title', async () => {
      await setPageAction(99, 'do.main', { kind: 'local' })

      expect(chrome.action.setTitle).calledOnceWith({
        tabId: 99,
        title: `do.main is a local resource`
      })
      expect(chrome.action.setIcon).calledOnceWith({
        tabId: 99,
        path: sinon.match('local_resource.png')
      })
      expect(saveIconSpy).calledWith('do.main', '/img/local_resource.png')
    })

    it('sets loading action icon and title', async () => {
      await setPageAction(99, 'do.main', { kind: 'loading' })

      expect(chrome.action.setTitle).calledOnceWith({
        tabId: 99,
        title: `Resolving do.main …`
      })
      expect(chrome.action.setIcon).calledOnceWith({
        tabId: 99,
        imageData: { 64: sinon.match.any }
      })
      expect(saveIconSpy).not.called
    })

    it('sets error action icon and title', async () => {
      await setPageAction(99, 'do.main', { kind: 'error', title: 'bonk!' })

      expect(chrome.action.setTitle).calledOnceWith({
        tabId: 99,
        title: `bonk!`
      })
      expect(chrome.action.setIcon).calledOnceWith({
        tabId: 99,
        imageData: { 64: sinon.match.any }
      })
      expect(saveIconSpy).not.called
    })

    it('sets resolved flag action icon and title', async () => {
      await setPageAction(99, 'do.main', {
        kind: 'geo',
        country_code: 'np',
        title: 'nepal ftw'
      })

      expect(chrome.action.setTitle).calledOnceWith({
        tabId: 99,
        title: `nepal ftw`
      })
      expect(chrome.action.setIcon).calledOnceWith({
        tabId: 99,
        imageData: { 64: sinon.match.any }
      })
      expect(saveIconSpy).calledWith('do.main', '/img/flags/np.png')
    })

    describe('Canvasing  🎨', () => {
      const { clearRect, drawImage, getImageData } = Context2dStub

      const createImageBitmapStub = pickStub('createImageBitmap', global)
      const closeBitmapStub = sinon.stub()

      const stubImageRead = (width: number, height: number) =>
        createImageBitmapStub
          .onFirstCall()
          .resolves({ width, height, close: closeBitmapStub })

      const stubImageResize = () =>
        createImageBitmapStub.onSecondCall().callsFake(
          (_, { resizeWidth, resizeHeight }) =>
            new Promise(resolve => {
              setTimeout(() => {
                resolve({
                  width: resizeWidth,
                  height: resizeHeight,
                  close: closeBitmapStub
                })
              }, 15)
            })
        )

      beforeEach(() => {
        fetchResultStub.blob.resolves('🖼')
        getImageData.returns('🖼 from canvas')
      })

      afterEach(() => {
        closeBitmapStub.resetHistory()
      })

      describe('Progress icons ', () => {
        const fillTextStub = pickStub('fillText', Context2dStub)
        const fetchStub = pickStub('fetch', global)

        it('renders 🔵 when loading', async () => {
          await setPageAction(123, 'is.loadi.ng', { kind: 'loading' })

          expect(drawSpy).calledBefore(glyphSpy)
          expect(blurSpy).not.called
          expect(fetchStub).calledWith('/img/icon/32.png')
          expect(fillTextStub).calledWith('🔵')
        })

        it('renders 🔴 when errored out', async () => {
          await setPageAction(123, 'nope.error', {
            kind: 'error',
            title: 'nah'
          })

          expect(glyphSpy).calledAfter(drawSpy)
          expect(blurSpy).not.called
          expect(fetchStub).calledWith('/img/icon/32.png')
          expect(fillTextStub).calledWith('🔴')
        })

        it('blurs existing icon when loading', async () => {
          new FakeStorage({
            'resolved.domain': {
              icon: 'anything.png',
              ...getGeoResponse('x.x.x.x')
            }
          })

          await setPageAction(123, 'resolved.domain', {
            kind: 'error',
            title: 'nah'
          })

          expect(blurSpy).calledBefore(drawSpy)
          expect(glyphSpy).not.called
          expect(fetchStub).calledWith('anything.png')
          expect(fillTextStub).not.called
        })

        it('blurs local domain icon when loading', async () => {
          new FakeStorage({
            'local.domain': { is_local: true }
          })

          await setPageAction(123, 'local.domain', {
            kind: 'local'
          })

          // initial draw — local_resource.png
          expect(fetchStub).not.called
          expect(fillTextStub).not.called

          await setPageAction(123, 'local.domain', {
            kind: 'loading'
          })

          expect(blurSpy).calledBefore(drawSpy)
          expect(glyphSpy).not.called
          expect(fetchStub).calledWithMatch('local_resource.png')
          expect(fillTextStub).not.called
        })

        describe('Firefox', () => {
          before(() => {
            // @ts-expect-error: let's pretend we are in firefox
            chrome.dns = 'is there'
          })

          after(() => {
            // @ts-expect-error: stop pretending we are in firefox
            delete chrome.dns
          })

          it('adds character with overhang (q) to a glyph', async () => {
            await setPageAction(123, 'is.loadi.ng', { kind: 'loading' })

            expect(fetchStub).calledWith('/img/icon/32.png')
            expect(fillTextStub).calledWith('🔵 q')
          })

          it('draws glyph on existing icon when loading', async () => {
            new FakeStorage({
              'resolved.domain': {
                icon: 'flaggo.png',
                ...getGeoResponse('x.x.x.x')
              }
            })

            await setPageAction(123, 'resolved.domain', {
              kind: 'loading'
            })

            expect(glyphSpy).calledAfter(drawSpy)
            expect(blurSpy).not.called
            expect(fetchStub).calledWith('flaggo.png')
            expect(fillTextStub).calledWith('🔵 q')
          })

          it('draws glyph on existing icon for local domains', async () => {
            new FakeStorage({
              'local.domain': { is_local: true }
            })

            await setPageAction(123, 'local.domain', {
              kind: 'local'
            })

            // initial draw — local_resource.png
            expect(glyphSpy).not.called
            expect(blurSpy).not.called
            expect(fetchStub).not.called
            expect(fillTextStub).not.called

            await setPageAction(123, 'local.domain', {
              kind: 'loading'
            })

            expect(glyphSpy).calledAfter(drawSpy)
            expect(blurSpy).not.called
            expect(fetchStub).calledWithMatch('local_resource.png')
            expect(fillTextStub).calledWith('🔵 q')
          })
        })
      })

      describe('Flags 🚩', () => {
        it('throws if could not get 2d context', async () => {
          const stub = sinon
            .stub(OffscreenCanvas.prototype, 'getContext')
            .returns(null)

          let error
          try {
            await setPageAction(123, 'boo.p', { kind: 'loading' })
          } catch (e) {
            error = e
          }

          expect(error)
            .to.be.instanceOf(Error)
            .to.have.property('message', 'Failed to get 2d canvas context')

          stub.restore()
        })

        const expectResize = (
          [width = 0, height = 0, scale = 0],
          [pX = 0, pY = 0]
        ) => {
          // clear canvas
          expect(clearRect).calledOnceWithExactly(0, 0, 64, 64)
          // create bitmap from blob, read dimensions
          expect(createImageBitmapStub.firstCall).calledWithExactly('🖼')
          // upscale
          expect(createImageBitmapStub.secondCall).calledWithExactly('🖼', {
            resizeQuality: 'pixelated',
            resizeWidth: width * scale,
            resizeHeight: height * scale
          })
          // dispose of bitmaps
          expect(closeBitmapStub).calledTwice
          // center upscaled bitmap vertically in 64x64
          expect(drawImage).calledOnceWithExactly(
            sinon.match({ width: width * scale, height: height * scale }),
            pX,
            pY
          )
          // send to browser
          expect(chrome.action.setIcon).calledWithExactly({
            tabId: TAB_ID,
            imageData: { '64': '🖼 from canvas' }
          })
        }

        const geoKind = { kind: 'geo', title: 'geo kind of action' } as const

        it('upscales, centers and renders the flag', async () => {
          stubImageRead(16, 11)
          stubImageResize()
          await setPageAction(TAB_ID, 'boop.ua', {
            ...geoKind,
            country_code: 'UA'
          })

          expectResize([16, 11, 4], [0, 10])
        })

        it('handles narrow 🇳🇵 flag', async () => {
          stubImageRead(9, 11)
          stubImageResize()
          await setPageAction(TAB_ID, 'Nepal', {
            ...geoKind,
            country_code: 'NP'
          })

          expectResize([9, 11, 4], [14, 10])
        })

        it("handles smol flag (don't have those but still)", async () => {
          stubImageRead(4, 5)
          stubImageResize()
          await setPageAction(TAB_ID, 'Promes land', {
            ...geoKind,
            country_code: 'BOOP'
          })

          expectResize([4, 5, 4], [24, 22])
        })
      })
    })
  })

  describe('resolve', () => {
    const fetchStub = pickStub('fetch', global)

    describe('Google DoH', () => {
      it('returns undefined when network errors out', async () => {
        fetchStub.throws()

        expect(await resolve('boop.com')).to.be.undefined
      })

      it('returns undefined when gets http error', async () => {
        expect(await resolve('boop.com')).to.be.undefined
      })

      it('returns undefined when DoH errors out', async () => {
        fetchResultStub.ok = true
        fetchResultStub.json.resolves({ Status: 88 })

        expect(await resolve('boop.com')).to.be.undefined
      })

      it('returns undefined when gets no Answer', async () => {
        fetchResultStub.ok = true
        fetchResultStub.json.resolves({ Status: 0 })

        expect(await resolve('boop.com')).to.be.undefined
      })

      it('returns undefined when gets no Answer with type 1 (A record)', async () => {
        fetchResultStub.ok = true
        fetchResultStub.json.resolves({
          Status: 0,
          Answer: [{ type: 'not 1' }]
        })

        expect(await resolve('boop.com')).to.be.undefined
      })

      it('returns undefined when gets no data for Answer with type 1', async () => {
        fetchResultStub.ok = true
        fetchResultStub.json.resolves({ Status: 0, Answer: [{ type: 1 }] })

        expect(await resolve('boop.com')).to.be.undefined
      })

      it('makes correct query', async () => {
        await resolve('boop.com')

        expect(fetchStub).calledOnceWith(
          'https://dns.google/resolve?type=1&name=boop.com'
        )
      })

      it('resolves IP address', async () => {
        fetchResultStub.ok = true
        fetchResultStub.json.resolves(getDohResponse('7.7.7.7'))

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

      const resolveStub = pickStub('resolve', browser.dns)

      it('resolves IP without fetch', async () => {
        resolveStub.resolves({ addresses: ['66.66.66.66'] })

        expect(await resolve('boop.com')).to.eq('66.66.66.66')
        expect(fetchStub).not.called
      })

      it('falls back to DoH when could not resolve', async () => {
        resolveStub.rejects('nope')
        await resolve('boop.com')

        expect(fetchStub).calledOnceWith(
          'https://dns.google/resolve?type=1&name=boop.com'
        )
      })
    })
  })
})
