import sinon from 'sinon'
import { expect } from 'chai'

import { readFileSync as readFile } from 'fs'
import jsdom from 'jsdom-global'

import { pickStub } from './setup.js'
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

describe('popup.ts', () => {
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
          fetched_at: new Date().getTime(),
          ip: 'z.z.z.z',
          country_code: 'UA',
          country_name: 'Ukraine',
          city: 'Kyiv',
          region: 'Kyiv City',
          postal_code: '03453'
        }
      })

      await handleDomReady()

      click(get('.button.reload'))
      await new Promise(setImmediate)

      expect(fetchStub.firstCall).calledWithMatch('flags/ua.png')

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
          fetched_at: new Date().getTime(),
          ip: 'z.z.z.z',
          country_code: 'UA',
          country_name: 'Ukraine',
          city: 'Kyiv',
          region: 'Kyiv City',
          postal_code: '03453'
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
          fetched_at: new Date().getTime(),
          ip: 'z.z.z.z',
          country_code: 'UA',
          country_name: 'Ukraine',
          city: 'Kyiv',
          region: 'Kyiv City',
          postal_code: '03453'
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

  it('does not render toolbar for local IPs', async () => {
    queryStub.resolves([{ url: 'http://resolved.local', id: 88 }])
    getStub.resolves({
      'resolved.local': {
        fetched_at: new Date().getTime(),
        ip: '10.x.x.x',
        is_local: true
      }
    })

    await handleDomReady()

    expect(get('.toolbar')).to.have.empty.text

    expect(get('.header')).to.have.text('Local resource')
    expect(get('.resolved'))
      .to.have.text('10.x.x.x')
      .to.have.attr('title', 'Resolved IP address')
  })

  it('allows to mark unresolved domain as local', async () => {
    const now = new Date().getTime()
    queryStub.resolves([{ url: 'http://not.resolved', id: 88 }])
    getStub.resolves({
      'not.resolved': {
        fetched_at: now,
        error: 'not found this one'
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
        fetched_at: now,
        error: 'not found this one',
        is_local: true
      }
    })

    expect(get('.button.marklocal'))
      .to.have.class('marked')
      .attr('title', 'Unmark domain as local')

    expect(fetchStub).not.to.be.called
  })

  it('refetches when unmarked as local', async () => {
    queryStub.resolves([{ url: 'http://marked.as.local', id: 88 }])

    fetchResultStub.ok = true
    fetchResultStub.json.resolves({
      error: 'nope, not resolved still'
    })

    const data = {
      fetched_at: new Date().getTime(),
      error: 'not found, this one'
    }
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

    expect(get('.header')).to.have.text('Local resource')
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

    expect(get('.header')).to.have.text('marked.as.local')
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
})
