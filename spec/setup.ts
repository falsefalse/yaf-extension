/// <reference types="./chai-html.d.ts" />

import sinon, { type SinonStub } from 'sinon'
import chai from 'chai'
import sinonChai from 'sinon-chai'
import chaiDom from 'chai-dom'
import chaiHtml from 'chai-html'

import type { OverloadedReturnType } from '../src/lib/es5.js'
import type { DoHResponse, GeoResponse } from '../src/lib/types.js'

/* Matchers */

chai.use(sinonChai)
chai.use(chaiDom)
chai.use(chaiHtml)

// both chai-dom and chai-html use .html, last one wins
// to make 🦜 happy — alias the method and it's declaration
chai.Assertion.addProperty('htmll', function () {
  chai.util.flag(this, 'html', true)
})

/* OffscreenCanvas, createImageBitmap */

const canvasBox = sinon.createSandbox({
  properties: ['spy', 'stub']
})

interface OffscreenCanvasMock {
  props: Record<string, unknown>
}

class OffscreenCanvasMock {
  constructor(width: number, height: number) {
    this.props = { width, height }
  }

  getContext() {
    return {
      canvas: { ...this.props },

      ...Context2d
    }
  }
}

const Context2d = {
  clearRect: canvasBox.spy(),
  drawImage: canvasBox.spy(),
  getImageData: canvasBox.stub(),
  measureText: canvasBox.stub(),
  fillText: canvasBox.stub()
}

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

interface Storage {
  store: Record<string, Record<string, unknown>>
}

class Storage {
  constructor(data: Storage['store']) {
    this.store = data

    // @ts-expect-error: faking local storage
    chrome.storage.local = this
  }

  async get(key: string) {
    return Promise.resolve({ [key]: this.store[key] })
  }

  async set(toSet: Storage['store']) {
    Object.entries(toSet).forEach(([key, value]) => {
      this.store[key] = { ...this.store[key], ...value }
    })

    return Promise.resolve()
  }
}

const action = {
  setTitle: chromeBox.stub(),
  setIcon: chromeBox.stub(),
  disable: chromeBox.stub(),
  enable: chromeBox.stub()
}

const resolve = chromeBox.stub()

const chromeEventsBox = sinon.createSandbox({
  properties: ['stub']
})

const tabs = {
  onUpdated: { addListener: chromeEventsBox.stub() },
  onActivated: { addListener: chromeEventsBox.stub() },
  get: chromeBox.stub(),
  query: chromeBox.stub()
}

const runtime = {
  onInstalled: { addListener: chromeEventsBox.stub() }
}

/* fetch, Headers */

const fetchBox = sinon.createSandbox({ properties: ['stub'] })

const fetchResult = {
  ok: false,
  status: 0,
  blob: fetchBox.stub(),
  json: fetchBox.stub(),
  text: fetchBox.stub()
}

const fetch = fetchBox.stub()

class HeadersMock {
  constructor(headers: any) {
    return headers
  }
}

/* Assign to window */
declare global {
  /* eslint-disable no-var */
  var Context2dStub: typeof Context2d
  var fetchResultStub: typeof fetchResult
  var FakeStorage: typeof Storage
  /* eslint-enable no-var */
}

Object.assign(global, {
  Context2dStub: Context2d,
  fetchResultStub: fetchResult,
  FakeStorage: Storage,

  fetch,
  Headers: HeadersMock,

  OffscreenCanvas: OffscreenCanvasMock,
  createImageBitmap,

  browser: {
    dns: { resolve }
  },

  chrome: {
    storage: { local },
    action,
    runtime,
    tabs
  }
})

/* Reset implementations */

export const mochaHooks = {
  beforeEach() {
    // restore storage back, in case of FakeStorage was used
    Object.assign(chrome.storage, { local })

    fetch.resolves(fetchResult)

    createImageBitmap.resolves({
      width: 'not set',
      height: 'not set either',
      close() {}
    })

    Context2d.measureText.returns({
      width: 'text width not set',
      actualBoundingBoxDescent: 'text descent not set'
    })

    tabs.query.resolves([])
  },

  afterEach() {
    canvasBox.reset()
    chromeBox.reset()
    fetchBox.reset()
    // do not reset chromeEvents box, it is global for the whole chrome runtime
  }
}

/* Helpers */

export const pickStub = <
  O = any,
  K extends keyof O = keyof O,
  TAwaitedReturn = Awaited<OverloadedReturnType<O[K]>>
>(
  key: K,
  object: O
) =>
  object[key] as SinonStub<
    any[],
    TAwaitedReturn extends Array<infer I>
      ? Promise<Partial<I>[]>
      : Promise<Partial<TAwaitedReturn>>
  >

export const getDohResponse = (ip: string): DoHResponse => ({
  Status: 0,
  Answer: [{ type: 1, data: ip, TTL: 0, name: 'anything' }]
})

export const getGeoResponse = (
  ip: string,
  overrides?: Partial<GeoResponse>
): GeoResponse => ({
  country_code: 'UA',
  country_name: 'Ukraine',
  ip, // server echoes IP back
  city: 'Boyarka',
  region: 'Kyiv Metro Area',
  ...overrides
})
