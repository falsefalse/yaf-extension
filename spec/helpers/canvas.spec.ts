import { fetchMock } from '../setup'

import { setPageAction, SquareCanvas } from '../../src/helpers'

const TAB_ID = 14

const pixels = ({ ctx, size }: SquareCanvas) =>
  ctx.getImageData(0, 0, size, size).data

describe('Canvasing 🎨', () => {
  const context = OffscreenCanvasRenderingContext2D.prototype
  const drawImage = vi.spyOn(context, 'drawImage')
  const fillText = vi.spyOn(context, 'fillText')
  const createBitmap = vi.spyOn(globalThis, 'createImageBitmap')

  describe('Progress icons', () => {
    it('renders 🔵 when loading', async () => {
      await setPageAction(123, { kind: 'loading', domain: 'is.loadi.ng' })

      expect(fetchMock).toHaveBeenCalledWith('/img/icon/32.png')
      expect(fillText).toHaveBeenCalledWith(
        '🔵',
        expect.any(Number),
        expect.any(Number)
      )
      expect(fillText).toHaveBeenCalledAfter(drawImage)
    })

    it('renders 🔴 when errored out', async () => {
      await setPageAction(123, {
        kind: 'error',
        domain: 'nope.error',
        error: 'an error'
      })

      expect(fetchMock).toHaveBeenCalledWith('/img/icon/32.png')
      expect(fillText).toHaveBeenCalledWith(
        '🔴',
        expect.any(Number),
        expect.any(Number)
      )
      expect(fillText).toHaveBeenCalledAfter(drawImage)
    })

    it('renders 🔵 over local domain icon when loading', async () => {
      await chrome.storage.local.set({
        'local.domain': { fetched_at: 0, is_local: true }
      })

      await setPageAction(123, { kind: 'local', domain: 'local.domain' })

      // local resource icon is set by path, nothing is drawn
      expect(fetchMock).not.toHaveBeenCalled()
      expect(fillText).not.toHaveBeenCalled()

      await setPageAction(123, { kind: 'loading', domain: 'local.domain' })

      expect(fetchMock).toHaveBeenCalledWith('/img/local_resource.png')
      expect(fillText).toHaveBeenCalledWith(
        '🔵',
        expect.any(Number),
        expect.any(Number)
      )
      expect(fillText).toHaveBeenCalledAfter(drawImage)
    })

    it('really paints the glyph', async () => {
      const plain = new SquareCanvas()
      await plain.drawUpscaled('/img/icon/32.png')

      const glyphed = new SquareCanvas()
      await glyphed.drawUpscaledWithGlyph('/img/icon/32.png', '🔵')

      expect(pixels(glyphed)).not.toEqual(pixels(plain))
    })

    describe('Firefox', () => {
      beforeAll(() => {
        // @ts-expect-error: let's pretend we are in firefox
        chrome.dns = 'is there'
      })

      afterAll(() => {
        // @ts-expect-error: stop pretending we are in firefox
        delete chrome.dns
      })

      it('adds character with overhang (q) to a glyph', async () => {
        await setPageAction(123, { kind: 'loading', domain: 'is.loadi.ng' })

        expect(fetchMock).toHaveBeenCalledWith('/img/icon/32.png')
        expect(fillText).toHaveBeenCalledWith(
          '🔵 q',
          expect.any(Number),
          expect.any(Number)
        )
      })
    })
  })

  describe('Flags 🚩', () => {
    it('throws if could not get 2d context', async () => {
      vi.spyOn(OffscreenCanvas.prototype, 'getContext').mockReturnValue(null)

      await expect(
        setPageAction(123, { kind: 'loading', domain: 'boo.p' })
      ).rejects.toThrow('Failed to get 2d canvas context')
    })

    // real PNGs are decoded, their dimensions drive the upscale and the placement
    it('upscales 16 × 11 🇺🇦 four times and centers it vertically', async () => {
      await new SquareCanvas().drawUpscaled('/img/flags/ua.png')

      expect(createBitmap).toHaveBeenLastCalledWith(expect.any(Blob), {
        resizeQuality: 'pixelated',
        resizeWidth: 64,
        resizeHeight: 44
      })
      expect(drawImage).toHaveBeenCalledExactlyOnceWith(
        expect.any(ImageBitmap),
        0,
        10
      )
    })

    it('centers narrow 9 × 11 🇳🇵 both ways', async () => {
      await new SquareCanvas().drawUpscaled('/img/flags/np.png')

      expect(createBitmap).toHaveBeenLastCalledWith(expect.any(Blob), {
        resizeQuality: 'pixelated',
        resizeWidth: 36,
        resizeHeight: 44
      })
      expect(drawImage).toHaveBeenCalledExactlyOnceWith(
        expect.any(ImageBitmap),
        14,
        10
      )
    })

    it('scales everything else to fill the square', async () => {
      await new SquareCanvas().drawUpscaled('/img/icon/32.png')

      expect(createBitmap).toHaveBeenLastCalledWith(expect.any(Blob), {
        resizeQuality: 'pixelated',
        resizeWidth: 64,
        resizeHeight: 64
      })
      expect(drawImage).toHaveBeenCalledExactlyOnceWith(
        expect.any(ImageBitmap),
        0,
        0
      )
    })

    it('sends the flag to the browser', async () => {
      await setPageAction(TAB_ID, {
        kind: 'geo',
        domain: 'boop.ua',
        data: { country_name: 'Ukraine', country_code: 'UA' }
      })

      expect(fetchMock).toHaveBeenCalledWith('/img/flags/ua.png')
      expect(chrome.action.setIcon).toHaveBeenCalledExactlyOnceWith({
        tabId: TAB_ID,
        imageData: { 64: expect.any(ImageData) }
      })
    })
  })
})
