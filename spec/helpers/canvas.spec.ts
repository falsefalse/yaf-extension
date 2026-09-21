import { fetchMock } from '../setup'

import { SquareCanvas } from '../../src/helpers'

const TAB_ID = 14

const pixels = ({ ctx, size }: SquareCanvas) =>
  ctx.getImageData(0, 0, size, size).data

describe('Canvasing 🎨', () => {
  const context = OffscreenCanvasRenderingContext2D.prototype
  const drawImage = vi.spyOn(context, 'drawImage')
  const createBitmap = vi.spyOn(globalThis, 'createImageBitmap')
  const setIcon = vi.mocked(chrome.action.setIcon)

  it('throws if could not get 2d context', () => {
    vi.spyOn(OffscreenCanvas.prototype, 'getContext').mockReturnValue(null)

    expect(() => new SquareCanvas()).toThrow('Failed to get 2d canvas context')
  })

  describe('Flags 🚩', () => {
    it('upscales 16 × 11 🇺🇦 four times and centers it vertically', async () => {
      await new SquareCanvas().setUpscaledIcon({
        tabId: TAB_ID,
        path: '/img/flags/ua.png'
      })

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
      await new SquareCanvas().setUpscaledIcon({
        tabId: TAB_ID,
        path: '/img/flags/np.png'
      })

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
      await new SquareCanvas().setUpscaledIcon({
        tabId: TAB_ID,
        path: '/img/icon/32.png'
      })

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

    it('sends what it drew to the browser', async () => {
      const canvas = new SquareCanvas()
      await canvas.setUpscaledIcon({
        tabId: TAB_ID,
        path: '/img/flags/ua.png'
      })

      expect(fetchMock).toHaveBeenCalledWith('/img/flags/ua.png')
      // can't assert against real bitmap since we upscale it
      expect(setIcon).toHaveBeenCalledExactlyOnceWith(
        {
          tabId: TAB_ID,
          imageData: { 64: expect.objectContaining({ data: pixels(canvas) }) }
        },
        expect.any(Function)
      )
    })

    it('really paints the glyph', async () => {
      const plain = new SquareCanvas()
      await plain.setUpscaledIcon({ tabId: TAB_ID, path: '/img/icon/32.png' })

      const glyphed = new SquareCanvas()
      await glyphed.setUpscaledIcon({
        tabId: TAB_ID,
        path: '/img/icon/32.png',
        glyph: '🔵'
      })

      expect(pixels(glyphed)).not.toEqual(pixels(plain))
    })
  })

  describe('Progress sweep', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    const start = () =>
      new SquareCanvas().animateProgress({
        tabId: TAB_ID,
        path: '/img/icon/32.png'
      })

    const frameCount = () => setIcon.mock.calls.length

    const frame = (nth: number) => {
      const imageData = setIcon.mock.calls.at(nth)?.[0].imageData
      if (imageData && 64 in imageData) return imageData[64]?.data
    }

    it('closes the circle when the lookup beats the fill', async () => {
      const stop = await start()

      // the base icon is decoded before the first frame, nothing sent yet
      expect(setIcon).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(50)
      const filled = frameCount()
      expect(filled).toBeGreaterThan(0)
      expect(setIcon).toHaveBeenLastCalledWith(
        { tabId: TAB_ID, imageData: { 64: expect.any(ImageData) } },
        expect.any(Function)
      )

      let closed = false
      const closing = stop().then(() => (closed = true))

      // the closing move paints frames of its own and holds before resolving,
      // so a barely-started circle still reads as one that completed
      await vi.advanceTimersByTimeAsync(100)
      expect(frameCount()).toBeGreaterThan(filled)
      expect(closed).toBe(false)

      await vi.advanceTimersByTimeAsync(500)
      await closing
      expect(closed).toBe(true)

      expect(frame(-1)).not.toEqual(frame(-2))

      const final = frameCount()
      await vi.advanceTimersByTimeAsync(1000)
      expect(frameCount()).toBe(final)
    })

    it('closes the circle when the lookup outlasts the fill', async () => {
      const stop = await start()

      await vi.advanceTimersByTimeAsync(200)
      const early = frameCount()

      // the easing only ever approaches full, so it never runs out of frames
      // to paint and a slow lookup keeps being told something is happening
      await vi.advanceTimersByTimeAsync(2000)
      const filled = frameCount()
      expect(filled).toBeGreaterThan(early)

      let closed = false
      const closing = stop().then(() => (closed = true))

      await vi.advanceTimersByTimeAsync(100)
      expect(frameCount()).toBeGreaterThan(filled)
      expect(closed).toBe(false)

      await vi.advanceTimersByTimeAsync(500)
      await closing
      expect(closed).toBe(true)

      const final = frameCount()
      await vi.advanceTimersByTimeAsync(1000)
      expect(frameCount()).toBe(final)
    })

    it('stops painting when the tab goes away mid-sweep', async () => {
      const stop = await start()

      await vi.advanceTimersByTimeAsync(50)
      const painted = frameCount()
      expect(painted).toBeGreaterThan(0)

      // chrome reports a closed tab through lastError, never a rejection
      vi.spyOn(chrome.runtime, 'lastError', 'get').mockReturnValue({
        message: `No tab with id: ${TAB_ID}.`
      })
      setIcon.mockImplementation((_details, done) => done())

      // one frame discovers the tab is gone, the fill stops asking after it
      await vi.advanceTimersByTimeAsync(50)
      const attempted = frameCount()
      expect(attempted).toBe(painted + 1)

      await vi.advanceTimersByTimeAsync(1000)
      expect(frameCount()).toBe(attempted)

      // the closing move asks for nothing, the handle still resolves on time
      const closing = stop()
      await vi.advanceTimersByTimeAsync(500)
      await expect(closing).resolves.toBeUndefined()
      expect(frameCount()).toBe(attempted)
    })
  })
})
