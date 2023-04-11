import sinon, { type SinonStub } from 'sinon'
import chai from 'chai'
import sinonChai from 'sinon-chai'

import type { OverloadedReturnType } from '../src/lib/es5.js'
import type { DoHResponse, GeoResponse } from '../src/lib/types.js'

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

const Context2d = {
  clearRect: canvasBox.spy(),
  drawImage: canvasBox.spy(),
  getImageData: canvasBox.stub()
}

const getContextStub = canvasBox.stub()
OffscreenCanvasMock.prototype.getContext = getContextStub

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

const fetchResult = {
  ok: false,
  status: 0,
  blob: fetchBox.stub(),
  json: fetchBox.stub(),
  text: fetchBox.stub()
}

const fetch = fetchBox.stub()

/* Assign to window */

declare global {
  /* eslint-disable no-var */
  var Context2dStub: typeof Context2d
  var fetchResultStub: typeof fetchResult
  /* eslint-enable no-var */
}

class HeadersMock {
  constructor(headers: any) {
    return headers
  }
}

Object.assign(global, {
  Context2dStub: Context2d,
  fetchResultStub: fetchResult,

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

/* Reset implementations */

export const mochaHooks = {
  beforeEach() {
    fetch.resolves(fetchResult)
    createImageBitmap.resolves({
      width: 'not set',
      height: 'not set either',
      close() {}
    })
    getContextStub.returns(Context2d)
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

export const getGeoResponse = (
  ip: string,
  overrides?: GeoResponse
): GeoResponse => ({
  country_code: 'UA',
  country_name: 'Ukraine',
  ip, // server echoes IP back
  city: 'Boyarka',
  region: 'Kyiv Metro Area',
  ...overrides
})
