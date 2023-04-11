import sinon, { type SinonStub } from 'sinon'
import chai from 'chai'
import sinonChai from 'sinon-chai'

import type { OverloadedReturnType } from '../src/lib/es5.js'
import type { DoHResponse } from '../src/lib/types.js'

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
OffscreenCanvasMock.prototype.getContext = sinon.stub().returns(Context2dStub)

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
  setIcon: chromeBox.stub(),
  disable: chromeBox.stub(),
  enable: chromeBox.stub()
}

const resolve = chromeBox.stub()

/* fetch */

const fetchBox = sinon.createSandbox({ properties: ['stub'] })

const fetchResultStub = {
  okStub: fetchBox.stub<any[], boolean>(),
  statusStub: fetchBox.stub<any[], number>(),
  blob: fetchBox.stub(),
  json: fetchBox.stub(),
  text: fetchBox.stub()
}

Object.defineProperties(fetchResultStub, {
  ok: {
    get: fetchResultStub.okStub,
    enumerable: true
  },
  status: {
    get: fetchResultStub.statusStub,
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

class HeadersMock {
  constructor(headers: any) {
    return headers
  }
}

Object.assign(global, {
  globalStubs: stubs,

  fetch,
  Headers: HeadersMock,

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
    createImageBitmap.resolves({ width: 'not set', height: 'not set either' })
  },

  afterEach() {
    canvasBox.reset()
    chromeBox.reset()
    fetchBox.reset()
  }
}

/* Helpers */

export const pickStub = <O = any, K extends keyof O = keyof O>(
  key: K,
  object: O
) =>
  object[key] as SinonStub<
    any[],
    Partial<Awaited<Extract<OverloadedReturnType<O[K]>, Promise<any>>>> | any
  >

export const getDohResponse = (ip: string, status = 0): DoHResponse => ({
  Status: status,
  Answer: [{ type: 1, data: ip, TTL: 0, name: 'anything' }]
})
