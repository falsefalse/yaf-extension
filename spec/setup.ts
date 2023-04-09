import sinon from 'sinon'
import chai from 'chai'
import sinonChai from 'sinon-chai'

/* Matchers */

chai.use(sinonChai)

/* OffscreenCanvas */

const canvasSandbox = sinon.createSandbox({
  properties: ['spy']
})

class OffscreenCanvasMock {
  constructor() {}
  getContext() {}
}

canvasSandbox.spy(OffscreenCanvasMock.prototype, 'getContext')

/* chrome.storage.local */

const storageSandbox = sinon.createSandbox({
  properties: ['stub']
})

const local = {
  set: chromeSandbox.stub(),
  get: chromeSandbox.stub(),
  clear: chromeSandbox.stub()
}

/* Assign to window */

Object.assign(global, {
  OffscreenCanvas: canvasSandbox.spy(OffscreenCanvasMock),
  chrome: {
    storage: { local },
    action
  }
})

/* Reset call counts hook */

export const mochaHooks = {
  afterEach() {
    canvasSandbox.reset()
    chromeSandbox.resetHistory()
  }
}
