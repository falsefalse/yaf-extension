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

  it('does not try to render into empty DOM', async () => {
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

  it('closes popup and disables page action if URL is wronk', async () => {
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

      expect(fetchStub).calledWith(sinon.match('flags/ua.png'))

      click(get('.button.reload'))
      await new Promise(setImmediate)

      expect(fetchStub).calledWith(
        sinon.match('dns.google').and(sinon.match('furman.im'))
      )
      expect(fetchStub).calledWith(
        sinon.match('localhost:8080').and(sinon.match('furman.im'))
      )
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
    expect(get('.resolved')).to.have.text('10.x.x.x')
  })

  describe('Formatted hint', async () => {
    beforeEach(() => {
      queryStub.resolves([{ url: 'http://resolved.local', id: 88 }])
    })

    afterEach(() => {
      expect(get('.header')).to.have.text('Local resource')
      expect(get('.resolved')).to.have.text('192.168.x.x')
    })

    const local = (domain: string, fetched_at: Date) => ({
      [domain]: {
        fetched_at: fetched_at.getTime(),
        ip: '192.168.x.x',
        is_local: true
      }
    })

    it('month ago', async () => {
      const lastMonth = new Date('2023-03-10T16:35:35.000Z')
      getStub.resolves(local('resolved.local', lastMonth))

      await handleDomReady()

      // different locales produce different spaces for AM/PM
      // github has ' ', macOS has \u202
      expect(get('.resolved'))
        .to.have.attr('title')
        .that.includes('Resolved at 🕟 04:35')
        .and.includes('PM last month')
    })

    it('week ago', async () => {
      const lastWeek = new Date('2023-04-10T16:25:35.000Z')
      getStub.resolves(local('resolved.local', lastWeek))

      await handleDomReady()

      expect(get('.resolved'))
        .to.have.attr('title')
        .that.includes('Resolved at 🕓 04:25')
        .and.includes('PM last week')
    })
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
      'not.resolved': sinon.match({
        is_local: true
      })
    })

    expect(get('.button.marklocal'))
      .to.have.class('marked')
      .attr('title', 'Unmark domain as local')

    expect(fetchStub)
      .not.calledWith(
        sinon.match('dns.google').and(sinon.match('not.resolved'))
      )
      .not.calledWith(
        sinon.match('localhost:8080').and(sinon.match('not.resolved'))
      )
  })

  it('closes popup instead of marking when tab url has become wronk', async () => {
    const currentTab = { url: 'http://not.resolved', id: 88 }
    queryStub.resolves([currentTab])
    getStub.resolves({
      'not.resolved': {
        error: 'not found this one',
        fetched_at: NOW.getTime()
      }
    })

    await handleDomReady()

    currentTab.url = 'gopher://not.resolved'

    click(get('.button.marklocal'))
    await new Promise(setImmediate)

    expect(chrome.action.disable).calledOnceWith(88)
    expect(window.close).calledOnce
  })

  it('renders mark as local when domain is still not resolved after unmarking', async () => {
    queryStub.resolves([{ url: 'http://marked.as.local', id: 88 }])

    new FakeStorage({
      'marked.as.local': {
        fetched_at: NOW.getTime(),
        is_local: true,
        error: 'not resolved at first'
      }
    })

    fetchStub.withArgs(sinon.match('marked.as.local')).resolves({
      ok: true,
      json: () => Promise.resolve({ error: 'nope, not resolved still' })
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

    expect(fetchStub)
      .calledWith(sinon.match('dns.google').and(sinon.match('marked.as.local')))
      .calledWith(
        sinon.match('localhost:8080').and(sinon.match('marked.as.local'))
      )

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

    fetchStub
      .withArgs(sinon.match('unresolved.at.first'))
      .onFirstCall()
      .resolves({
        ok: true,
        json: () => Promise.resolve({ error: 'not resolved at first' })
      })
      .withArgs(sinon.match('unresolved.at.first'))
      .onSecondCall()
      .resolves({
        ok: true,
        json: () => Promise.resolve(getGeoResponse('x.x.x.x'))
      })

    new FakeStorage({
      'unresolved.at.first': {
        fetched_at: NOW.getTime(),
        is_local: true,
        error: 'not resolved at first'
      }
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

    expect(fetchStub).calledWith(
      sinon.match('dns.google').and(sinon.match('unresolved.at.first'))
    )
    expect(fetchStub).calledWith(
      sinon.match('localhost:8080').and(sinon.match('unresolved.at.first'))
    )

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

    it('animates for 2s when dice rolls less than 1/16', async () => {
      Math.random = () => 1 / 17

      await handleDomReady()

      expect(
        document.documentElement.style.getPropertyValue('--js-rotator-duration')
      ).to.eq('2000ms')

      expect(get('.rotator')).not.to.be.null
      clock.tick(2000)
      expect(get('.rotator')).to.be.null
    })

    it('does not animate when dice rolls more than 1/16', async () => {
      Math.random = () => 1

      await handleDomReady()

      expect(get('.rotator')).to.be.null
    })
  })
})
