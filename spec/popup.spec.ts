import sinon, { type SinonFakeTimers } from 'sinon'
import { expect } from 'chai'

import { readFileSync as readFile } from 'fs'
import jsdom from 'jsdom-global'

import { pickStub, getGeoResponse } from './setup.js'
import { handleDomReady } from '../src/popup.js'

const get = (s: string) => document.querySelector(s)
const getAll = (s: string) => document.querySelectorAll(s)
const click = (el: Element | null, eventInit: MouseEventInit = {}) =>
  el?.dispatchEvent(new MouseEvent('click', { bubbles: true, ...eventInit }))

const queryStub = pickStub('query', chrome.tabs)
const getStub = pickStub('get', chrome.storage.local)
const setStub = pickStub('set', chrome.storage.local)
const fetchStub = pickStub('fetch', global)
const popupHtml = readFile('./src/popup.html', 'utf8')

const NOW = new Date('2023-04-20T04:20:00.000Z')

describe('popup.ts', () => {
  let clock: SinonFakeTimers

  before(() => {
    clock = sinon.useFakeTimers({ now: NOW, toFake: ['Date', 'setTimeout'] })
  })

  after(() => {
    clock.restore()
  })

  beforeEach(() => {
    jsdom(popupHtml)

    sinon.stub(window, 'open')
    sinon.stub(window, 'close')
  })

  afterEach(() => {
    jsdom()
  })

  it('closes popup if there is no tab', async () => {
    await handleDomReady()

    expect(window.close).calledOnce
  })

  it('does not try to render into empty dom', async () => {
    jsdom('<nope>nothing</nope>')
    queryStub.resolves([{ id: 99, url: 'http://something' }])

    let error
    try {
      await handleDomReady()
    } catch (e) {
      error = e
    }

    expect(error).to.be.undefined
  })

  it('closes popup if tab has no id', async () => {
    queryStub.resolves([{ url: 'http://no.tabid' }])

    await handleDomReady()

    expect(window.close).calledOnce
  })

  it('closes popup and disables page action if url is wronk', async () => {
    queryStub.resolves([{ id: 99, url: 'wronk://url' }])

    await handleDomReady()

    expect(window.close).calledOnce
    expect(chrome.action.disable).calledOnceWith(99)
  })

  describe('Reload button', () => {
    it('fetches new data when reload clicked', async () => {
      queryStub.resolves([{ url: 'http://furman.im', id: 88 }])

      getStub.resolves({
        'furman.im': {
          fetched_at: NOW.getTime(),
          ...getGeoResponse('z.z.z.z')
        }
      })

      await handleDomReady()

      expect(fetchStub.firstCall).calledWithMatch('flags/ua.png')

      click(get('.button.reload'))
      await new Promise(setImmediate)

      expect(fetchStub.secondCall)
        .calledWithMatch('dns.google')
        .calledWithMatch('furman.im')
      expect(fetchStub.thirdCall)
        .calledWithMatch('localhost:8080')
        .calledWithMatch('furman.im')
    })

    it('opens donation link when reload is meta+clicked', async () => {
      queryStub.resolves([{ url: 'http://furman.im', id: 88 }])
      getStub.resolves({
        'furman.im': {
          fetched_at: NOW.getTime(),
          ...getGeoResponse('z.z.z.z')
        }
      })

      await handleDomReady()

      click(get('.button.reload'), { metaKey: true })
      await new Promise(setImmediate)

      expect(window.open).calledWith(
        sinon.match('savelife.in.ua/en'),
        '_blank',
        sinon.match.string
      )
    })
  })

  describe('Resolved', () => {
    it('renders geo data handsomely', async () => {
      queryStub.resolves([{ url: 'http://furman.im', id: 88 }])
      getStub.resolves({
        'furman.im': {
          fetched_at: NOW.getTime(),
          ...getGeoResponse('z.z.z.z', {
            city: 'Kyiv',
            region: 'Kyiv City',
            postal_code: '03453'
          })
        }
      })

      await handleDomReady()

      expect(get('.button.marklocal')).to.be.null
      expect(get('.button.reload')).to.exist

      expect(get('.header')).to.have.text('Ukraine')
      // prettier-ignore
      expect(getAll('.result li:not(.service, .separator)'))
        .to.have.trimmed.text([
          'Ukraine',
          'Kyiv, Kyiv City, 03453',
          'z.z.z.z'
        ])
      expect(get('.located')).to.exist

      expect(get('a.whois')).to.have.attr(
        'href',
        'https://whois.domaintools.com/furman.im'
      )
    })
  })

  it('does not render toolbar for local domains', async () => {
    queryStub.resolves([{ url: 'http://0.0.0.0', id: 88 }])

    await handleDomReady()

    expect(get('.toolbar')).to.be.empty

    expect(get('.header')).to.have.text('Local resource')
    expect(getAll('.result li')).to.have.text(['Local resource', '0.0.0.0'])
  })

  it('does not render toolbar for domains resolved to local IPs', async () => {
    queryStub.resolves([{ url: 'http://resolved.local', id: 88 }])
    getStub.resolves({
      'resolved.local': {
        fetched_at: NOW.getTime(),
        ip: '10.x.x.x',
        is_local: true
      }
    })

    await handleDomReady()

    expect(get('.toolbar')).to.be.empty

    expect(get('.header')).to.have.text('Local resource')
    expect(get('.resolved'))
      .to.have.text('10.x.x.x')
      .to.have.attr('title', 'Resolved IP address')
  })

  it('allows to mark unresolved domain as local', async () => {
    queryStub.resolves([{ url: 'http://not.resolved', id: 88 }])
    getStub.resolves({
      'not.resolved': {
        error: 'not found this one',
        fetched_at: NOW.getTime()
      }
    })

    await handleDomReady()

    expect(get('.button.marklocal')).to.have.attr(
      'title',
      'Mark domain as local'
    )

    click(get('.button.marklocal'))
    await new Promise(setImmediate)

    expect(setStub).calledWith({
      'not.resolved': {
        fetched_at: NOW.getTime(),
        error: 'not found this one',
        is_local: true
      }
    })

    expect(get('.button.marklocal'))
      .to.have.class('marked')
      .attr('title', 'Unmark domain as local')

    expect(fetchStub).not.called
  })

  it('renders mark as local when domain is still not resolved after unmarking', async () => {
    queryStub.resolves([{ url: 'http://marked.as.local', id: 88 }])

    fetchResultStub.ok = true
    fetchResultStub.json.resolves({
      error: 'nope, not resolved still'
    })

    const data = { fetched_at: NOW.getTime() }
    getStub
      .onFirstCall()
      .resolves({
        'marked.as.local': { ...data, is_local: true }
      })
      .onSecondCall()
      .resolves({
        'marked.as.local': { ...data, is_local: true }
      })
      .onThirdCall()
      .resolves({
        'marked.as.local': { ...data, is_local: false }
      })

    await handleDomReady()

    expect(get('.button.marklocal'))
      .to.have.class('marked')
      .to.have.attr('title', 'Unmark domain as local')

    expect(getAll('.result li')).to.have.text([
      'Local resource',
      'marked.as.local'
    ])

    click(get('.button.marklocal'))
    await new Promise(setImmediate)

    expect(fetchStub.firstCall)
      .calledWithMatch('dns.google')
      .calledWithMatch('marked.as.local')
    expect(fetchStub.secondCall)
      .calledWithMatch('localhost:8080')
      .calledWithMatch('marked.as.local')

    // store new data
    expect(setStub).calledWith({
      'marked.as.local': {
        fetched_at: NOW.getTime(),
        is_local: false,
        error: 'nope, not resolved still'
      }
    })

    expect(getAll('.result li')).to.have.text([
      'marked.as.local',
      'nope, not resolved still'
    ])

    expect(get('.button.marklocal')).not.to.have.class('marked')
    expect(get('.button.marklocal')).to.have.attr(
      'title',
      'Mark domain as local'
    )
  })

  it('hides mark button when domain resolves after unmarking', async () => {
    queryStub.resolves([{ url: 'http://unresolved.at.first', id: 88 }])

    fetchResultStub.ok = true
    fetchResultStub.json
      .onFirstCall()
      .resolves({
        error: 'not resolved at first'
      })
      .onSecondCall()
      .resolves({
        ...getGeoResponse('x.x.x.x')
      })

    const data = {
      fetched_at: NOW.getTime(),
      error: 'not resolved at first'
    }
    getStub
      .onFirstCall()
      .resolves({
        'unresolved.at.first': { ...data, is_local: true }
      })
      .onSecondCall()
      .resolves({
        'unresolved.at.first': { ...data, is_local: true }
      })
      .onThirdCall()
      .resolves({
        'unresolved.at.first': { ...data, is_local: false }
      })

    await handleDomReady()

    expect(get('.button.marklocal'))
      .to.have.class('marked')
      .to.have.attr('title', 'Unmark domain as local')

    expect(getAll('.result li')).to.have.text([
      'Local resource',
      'unresolved.at.first'
    ])

    click(get('.button.marklocal'))
    await new Promise(setImmediate)

    expect(fetchStub.firstCall)
      .calledWithMatch('dns.google')
      .calledWithMatch('unresolved.at.first')
    expect(fetchStub.secondCall)
      .calledWithMatch('localhost:8080')
      .calledWithMatch('unresolved.at.first')

    expect(get('.header')).to.have.text('Ukraine')
    expect(getAll('.result li:not(.separator)')).to.have.trimmed.text([
      'Ukraine',
      'Boyarka, Kyiv Metro Area',
      'x.x.x.x',
      'Whois'
    ])

    expect(get('.button.marklocal')).to.be.null
  })

  describe('Donation animation', () => {
    const random = { Math }

    beforeEach(() => {
      queryStub.resolves([{ url: 'http://furman.im', id: 88 }])

      getStub.resolves({
        'furman.im': {
          fetched_at: NOW.getTime(),
          ...getGeoResponse('z.z.z.z')
        }
      })
    })

    afterEach(() => {
      Object.assign(Math, { random })
    })

    it('animates for 2s when dice rolls less than 1/4', async () => {
      Math.random = () => 0.2

      await handleDomReady()

      expect(
        document.documentElement.style.getPropertyValue('--js-rotator-duration')
      ).to.eq('2000ms')

      expect(get('.rotator')).not.to.be.null
      clock.tick(2000)
      expect(get('.rotator')).to.be.null
    })

    it('does not animate when dice rolls more than 1/4', async () => {
      Math.random = () => 1

      await handleDomReady()

      expect(get('.rotator')).to.be.null
    })
  })
})
