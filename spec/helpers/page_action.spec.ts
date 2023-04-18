import sinon from 'sinon'
import { expect } from 'chai'

import { setPageAction } from '../../src/helpers/page_action.js'
import { storage } from '../../src/helpers/storage.js'

describe('setPageAction', () => {
  const saveIconSpy = sinon.spy(storage, 'saveDomainIcon')

  afterEach(() => {
    saveIconSpy.resetHistory()
  })

  it('sets local domain action icon and title', async () => {
    await setPageAction(99, 'do.main', { kind: 'local' })

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
    await setPageAction(99, 'do.main', { kind: 'loading' })

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
    await setPageAction(99, 'do.main', { kind: 'error', title: 'bonk!' })

    expect(chrome.action.setTitle).calledOnceWith({
      tabId: 99,
      title: `bonk!`
    })
    expect(chrome.action.setIcon).calledOnceWith({
      tabId: 99,
      imageData: { 64: sinon.match.any }
    })
    expect(saveIconSpy).not.called
  })

  it('sets resolved flag action icon and title', async () => {
    await setPageAction(99, 'do.main', {
      kind: 'geo',
      country_code: 'np',
      title: 'nepal ftw'
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
})
