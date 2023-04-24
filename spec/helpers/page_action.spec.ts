import sinon from 'sinon'
import { expect } from 'chai'

import { setPageAction, storage } from '../../src/helpers/index.js'

describe('setPageAction', () => {
  const saveIconSpy = sinon.spy(storage, 'saveDomainIcon')

  afterEach(() => {
    saveIconSpy.resetHistory()
  })

  it('sets local domain action icon and title', async () => {
    await setPageAction(99, { kind: 'local', domain: 'do.main' })

    expect(chrome.action.setTitle).calledOnceWith({
      tabId: 99,
      title: `do.main is a local resource`
    })
    expect(chrome.action.setIcon).calledOnceWith({
      tabId: 99,
      path: sinon.match('local_resource.png')
    })
    expect(saveIconSpy).calledWith('do.main', '/img/local_resource.png')
  })

  it('sets loading action icon and title', async () => {
    await setPageAction(99, { kind: 'loading', domain: 'do.main' })

    expect(chrome.action.setTitle).calledOnceWith({
      tabId: 99,
      title: `Resolving do.main …`
    })
    expect(chrome.action.setIcon).calledOnceWith({
      tabId: 99,
      imageData: { 64: sinon.match.any }
    })
    expect(saveIconSpy).not.called
  })

  it('sets error action icon and title', async () => {
    await setPageAction(99, {
      kind: 'error',
      domain: 'do.main',
      error: 'bonk!'
    })

    expect(chrome.action.setTitle).calledOnceWith({
      tabId: 99,
      title: 'Error: bonk!'
    })
    expect(chrome.action.setIcon).calledOnceWith({
      tabId: 99,
      imageData: { 64: sinon.match.any }
    })
    expect(saveIconSpy).not.called
  })

  it('sets resolved flag action icon and title', async () => {
    await setPageAction(99, {
      kind: 'geo',
      domain: 'do.main',
      data: {
        country_code: 'np',
        country_name: 'nepal ftw'
      }
    })

    expect(chrome.action.setTitle).calledOnceWith({
      tabId: 99,
      title: `nepal ftw`
    })
    expect(chrome.action.setIcon).calledOnceWith({
      tabId: 99,
      imageData: { 64: sinon.match.any }
    })
    expect(saveIconSpy).calledWith('do.main', '/img/flags/np.png')
  })

  it('throws if impossible path was reached', async () => {
    let error
    try {
      // @ts-expect-error: assertNever spec
      await setPageAction(99, { kind: 'impossible-kind' })
    } catch (e) {
      error = e
    }

    expect(error).to.have.property(
      'message',
      "Unreachable path reached with 'impossible-kind'"
    )
  })
})
