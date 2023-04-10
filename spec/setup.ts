import sinon from 'sinon'
import chai from 'chai'
import sinonChai from 'sinon-chai'

/* Matchers */

chai.use(sinonChai)

/* OffscreenCanvas, createImageBitmap */

const canvasBox = sinon.createSandbox({
  properties: ['spy', 'stub']
})

class OffscreenCanvasMock {
  constructor() {}
  getContext() {}
}

const Context2dStub = {
  clearRect: canvasBox.spy(),
  drawImage: canvasBox.spy(),
  getImageData: canvasBox.stub()
}

// don't want implementation to be reset hence sinon.stub
OffscreenCanvasMock.prototype.getContext = sinon
  .stub()
  .callsFake(() => Context2dStub)

const createImageBitmap = canvasBox.stub()

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

const resolve = chromeBox.stub()

/* fetch */

const fetchBox = sinon.createSandbox({ properties: ['stub'] })

const fetchResultStub = {
  okStub: fetchBox.stub(),
  blob: fetchBox.stub(),
  json: fetchBox.stub()
}

Object.defineProperties(fetchResultStub, {
  ok: {
    get: fetchResultStub.okStub,
    enumerable: true
  }
})

// implementation is (re)set in beforeEach
const fetch = fetchBox.stub()

/* Assign to window */

const stubs = { Context2dStub, fetchResultStub } as const

declare global {
  // eslint-disable-next-line no-var
  var globalStubs: typeof stubs
}

Object.assign(global, {
  globalStubs: stubs,

  fetch,

  OffscreenCanvas: OffscreenCanvasMock,
  createImageBitmap,

  browser: {
    dns: { resolve }
  },

  chrome: {
    storage: { local },
    action
  }
})

/* Reset call counts hook */

export const mochaHooks = {
  beforeEach() {
    fetch.resolves(fetchResultStub)
  },

  afterEach() {
    canvasBox.reset()
    chromeBox.reset()
    fetchBox.reset()
  }
}
