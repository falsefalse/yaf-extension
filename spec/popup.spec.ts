import sinon from 'sinon'
import { expect } from 'chai'

import { readFileSync as readFile } from 'fs'
import jsdom from 'jsdom-global'

import { pickStub } from './setup.js'
import { handleDomReady } from '../src/popup.js'

const get = (selector: string) => document.querySelector(selector)
const click = (el: Element | null) =>
  el?.dispatchEvent(new Event('click', { bubbles: true }))

const queryStub = pickStub('query', chrome.tabs)
const getStub = pickStub('get', chrome.storage.local)
pickStub('set', chrome.storage.local).callsFake(data => data)

const popupHtml = readFile('./src/popup.html', 'utf8')

describe('popup.ts', () => {
  beforeEach(() => {
    jsdom(popupHtml)
  })

  afterEach(() => {
    jsdom()
  })

  it('closes popup if there is no tab', async () => {
    const spy = sinon.spy(window, 'close')

    await handleDomReady()

    expect(spy).calledOnce
  })

  it('renders local IPs without mark button', async () => {
    queryStub.resolves([{ url: 'http://boop.url', id: 88 }])
    getStub.resolves({
      'boop.url': {
        fetched_at: new Date().getTime(),
        ip: 'x.x.x.x',
        is_local: true
      }
    })

    await handleDomReady()

    expect(get('.marklocal')).to.be.null
    expect(get('.toolbar')).to.have.empty.html
    expect(get('.header')).to.have.html('Local resource')
    expect(get('.resolved'))
      .to.have.html('x.x.x.x')
      .to.have.attr('title', 'Resolved IP address')
  })

  it('renders unresolved IPs with a mark button', async () => {
    queryStub.resolves([{ url: 'http://boop.url', id: 88 }])
    getStub.resolves({
      'boop.url': {
        fetched_at: new Date().getTime(),
        error: 'not found this one'
      }
    })

    await handleDomReady()

    expect(get('.marklocal')).to.have.attr('title', 'Mark domain as local')

    click(get('.marklocal'))
    await new Promise(setImmediate)

    expect(get('.marklocal'))
      .to.have.class('marked')
      .and.attr('title', 'Unmark domain as local')
  })
})
