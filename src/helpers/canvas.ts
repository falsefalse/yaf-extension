import { isFirefox } from './index.js'

export interface SquareCanvas {
  size: number
  ctx: OffscreenCanvasRenderingContext2D
}

export class SquareCanvas {
  // local_resource.png is 64x64, globe is 32x32, flags 16px wide
  // so upscale everything to 64px
  constructor(size = 64) {
    const ctx = new OffscreenCanvas(size, size).getContext('2d', {
      willReadFrequently: true
    })
    if (!ctx) throw new Error('Failed to get 2d canvas context')

    this.ctx = ctx
    this.size = size

    this.ctx.clearRect(0, 0, size, size)
  }

  private center(whole: number, part: number) {
    return Math.round(Math.max(whole - part, 0) / 2)
  }

  async drawUpscaled(path: string) {
    const { size, ctx, center } = this

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

  async drawUpscaledWithGlyph(path: string, glyph: string) {
    await this.drawUpscaled(path)
    this.addGlyph(glyph)
  }
  async drawUpscaledWithBlur(path: string) {
    this.blur()
    await this.drawUpscaled(path)
  }

  private blur(radius = 2) {
    this.ctx.filter = `blur(${radius}px)`
  }

  private addGlyph(glyph: string) {
    const { size, ctx } = this

    ctx.font = '24px serif'
    ctx.fillStyle = `rgb(0, 0, 0, 1)`

    // eslint-disable-next-line prefer-const
    let { width: textWidth, actualBoundingBoxDescent: textDescent } =
      ctx.measureText(glyph)

    // firefox needs something to hang down, otherwise emoji gets cut off
    if (isFirefox()) {
      glyph += ' q'
      textDescent = ctx.measureText(glyph).actualBoundingBoxDescent
    }

    ctx.fillText(glyph, size - textWidth, size - textDescent)
  }

  async setIconFromCanvas(tabId: number) {
    const { size, ctx } = this

    await chrome.action.setIcon({
      tabId,
      imageData: {
        [size.toString()]: ctx.getImageData(0, 0, size, size)
      }
    })
  }
}
