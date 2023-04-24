import sinon from 'sinon'
import { expect } from 'chai'
import { getGeoResponse, pickStub } from '../setup.js'

import { setPageAction, SquareCanvas } from '../../src/helpers/index.js'

const TAB_ID = 14

describe('Canvasing  🎨', () => {
  const actionBox = sinon.createSandbox({ properties: ['spy'] })
  const drawSpy = actionBox.spy(SquareCanvas.prototype, 'drawUpscaled')
  const glyphSpy = actionBox.spy(SquareCanvas.prototype, 'addGlyph' as any)
  const blurSpy = actionBox.spy(SquareCanvas.prototype, 'blur' as any)

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
    actionBox.reset()
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
