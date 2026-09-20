const center = (whole: number, part: number) =>
  Math.round(Math.max(whole - part, 0) / 2)

export class SquareCanvas {
  size: number
  ctx: OffscreenCanvasRenderingContext2D

  constructor(size = 64) {
    const ctx = new OffscreenCanvas(size, size).getContext('2d', {
      willReadFrequently: true
    })
    if (!ctx) throw new Error('Failed to get 2d canvas context')

    this.ctx = ctx
    this.size = size

    this.ctx.clearRect(0, 0, size, size)
  }

  private async drawUpscaled(path: string) {
    const { size, ctx } = this

    // read image and its dimensions
    const imgBlob = await (await fetch(path)).blob()
    const original = await createImageBitmap(imgBlob)
    const { width, height } = original
    original.close()

    // give all flags scale factor 4
    // pretend all flags are boxed in 16px wide box
    // they all are, apart from 9 x 11 Nepal 🇳🇵
    const scale = path.includes('/flags/') ? 4 : size / width

    // upscale without smoothing
    const upscaled = await createImageBitmap(imgBlob, {
      resizeQuality: 'pixelated',
      resizeWidth: width * scale,
      resizeHeight: height * scale
    })

    ctx.drawImage(
      upscaled,
      center(size, upscaled.width),
      center(size, upscaled.height)
    )
    upscaled.close()
  }

  private drawGlyph(glyph: string) {
    const { size, ctx } = this

    ctx.font = `36px serif`
    ctx.fillStyle = `rgb(0, 0, 0, 1)`

    const {
      width,
      actualBoundingBoxAscent: ascent,
      actualBoundingBoxDescent: descent
    } = ctx.measureText(glyph)

    const baseline = center(size, ascent + descent) + ascent
    ctx.fillText(glyph, center(size, width), baseline)
  }

  private drawSweep(progress: number) {
    const { ctx, size } = this

    const center = size / 2
    const noon = -Math.PI / 2

    // fade towards the toolbar, whatever colour it is
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = 'rgb(0 0 0 / 80%)'

    ctx.beginPath()
    ctx.moveTo(center, center)
    ctx.arc(center, center, size, noon, noon + 2 * Math.PI * progress)
    ctx.fill()
  }

  async setUpscaledIcon({
    tabId,
    path,
    glyph
  }: {
    tabId: number
    path: string
    glyph?: string
  }) {
    await this.drawUpscaled(path)
    if (glyph) this.drawGlyph(glyph)

    const { size, ctx } = this

    await chrome.action.setIcon({
      tabId,
      imageData: {
        [size.toString()]: ctx.getImageData(0, 0, size, size)
      }
    })
  }

  /** Fills while the work runs, the returned handle closes the circle. */
  async animateProgess({ tabId, path }: { tabId: number; path: string }) {
    const { size, ctx } = this

    await this.drawUpscaled(path)
    const base = ctx.getImageData(0, 0, size, size)

    const paint = (progress: number) => {
      ctx.putImageData(base, 0, 0)
      this.drawSweep(progress)

      void chrome.action.setIcon({
        tabId,
        imageData: { [size.toString()]: ctx.getImageData(0, 0, size, size) }
      })
    }

    // approaches full without ever reaching it
    const tauMs = 200
    const eased = (elapsedMs: number) => 1 - Math.exp(-elapsedMs / tauMs)

    const interval = 1000 / 60
    const started = performance.now()
    let progress = 0

    const fill = setInterval(() => {
      progress = eased(performance.now() - started)
      paint(progress)
    }, interval)

    // ease from wherever the fill got to, that closing move is what reads as done
    return () =>
      new Promise<void>(resolve => {
        clearInterval(fill)

        // the closing move, then the pause on a whole circle before the flag lands
        const closingMs = 80

        const from = progress
        const settling = performance.now()

        const settle = setInterval(() => {
          const ratio = (performance.now() - settling) / closingMs

          if (ratio >= 1) {
            clearInterval(settle)
            paint(1)
            setTimeout(resolve, closingMs)
            return
          }

          paint(from + (1 - from) * ratio)
        }, interval)
      })
  }
}
