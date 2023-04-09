import sinon from 'sinon'
import chai from 'chai'
import sinonChai from 'sinon-chai'

/* Matchers */

chai.use(sinonChai)

/* OffscreenCanvas */

const canvasBox = sinon.createSandbox({
  properties: ['spy', 'stub']
})

class OffscreenCanvasMock {
  constructor() {}
  getContext() {}
}

const OffscreenCanvas = canvasBox.spy(OffscreenCanvasMock)

const Context2dStub = {
  clearRect: canvasBox.spy(),
  drawImage: canvasBox.spy(),
  getImageData: canvasBox.stub()
}

canvasBox
  .stub(OffscreenCanvasMock.prototype, 'getContext')
  .callsFake(() => Context2dStub)

/* chrome */

const chromeBox = sinon.createSandbox({
  properties: ['stub']
})

const local = {
  set: chromeBox.stub(),
  get: chromeBox.stub(),
  clear: chromeBox.stub()
}

const action = {
  setTitle: chromeBox.stub(),
  setIcon: chromeBox.stub()
}

/* fetch */

const fetch = () =>
  Promise.resolve({
    blob: () => Promise.resolve('🖼')
  })

/* createImageBitmap */

const windowBox = sinon.createSandbox({ properties: ['stub'] })
const createImageBitmap = windowBox.stub()

/* Assign to window */

Object.assign(global, {
  createImageBitmap,
  fetch,
  OffscreenCanvas,
  chrome: {
    storage: { local },
    action
  }
})

/* Reset call counts hook */

export const mochaHooks = {
  afterEach() {
    canvasBox.resetHistory()
    chromeBox.resetHistory()
    windowBox.resetHistory()
  }
}
