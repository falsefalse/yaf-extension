import { expect } from 'chai'

import { pickStub } from './setup.js'

import { onActivated, onInstalled, onUpdated } from '../src/service.js'

const getTabStub = pickStub('get', chrome.tabs)
const queryStub = pickStub('query', chrome.tabs)
const getStub = pickStub('get', chrome.storage.local)

const TAB_ID = 1312

describe('service.ts', () => {
  it('assigns event listeners', () => {
    expect(chrome.tabs.onUpdated.addListener).calledOnceWith(onUpdated)
    expect(chrome.tabs.onActivated.addListener).calledOnceWith(onActivated)
    expect(chrome.runtime.onInstalled.addListener).calledOnceWith(onInstalled)
  })

  describe('onActivated', async () => {
    it('sets the flag', async () => {
      getTabStub.resolves({ id: TAB_ID, url: 'http://tab.bo' })
      getStub.resolves({
        'tab.bo': {
          fetched_at: new Date().getTime(),
          is_local: true
        }
      })

      await onActivated({ tabId: TAB_ID })

      expect(chrome.action.setIcon).calledWith({
        tabId: TAB_ID,
        path: '/img/local_resource.png'
      })
      expect(chrome.action.setTitle).calledWith({
        tabId: TAB_ID,
        title: 'tab.bo is a local resource'
      })
    })

    it('does nothing if tab is not there', async () => {
      getTabStub.resolves()

      await onActivated({ tabId: TAB_ID })

      expect(chrome.action.setIcon).not.called
      expect(chrome.action.setTitle).not.called
    })

    it('does nothing if tabs.getTab throws', async () => {
      getTabStub.throws()

      await onActivated({ tabId: TAB_ID })

      expect(chrome.action.setIcon).not.called
      expect(chrome.action.setTitle).not.called
    })

    it('does nothing if tab has no url', async () => {
      getTabStub.throws({ id: TAB_ID })

      await onActivated({ tabId: TAB_ID })

      expect(chrome.action.setIcon).not.called
      expect(chrome.action.setTitle).not.called
    })
  })

  describe('onUpdated', () => {
    it('sets flag', async () => {
      await onUpdated(0, { status: undefined }, {} as chrome.tabs.Tab)

      expect(chrome.action.setIcon).not.called
      expect(chrome.action.setTitle).not.called
    })

    it('does nothing if status is undefined', async () => {
      getStub.resolves({
        'tabber.tab': {
          fetched_at: new Date().getTime(),
          is_local: true
        }
      })

      await onUpdated(0, { status: 'is defined' }, {
        id: TAB_ID,
        url: 'http://tabber.tab'
      } as chrome.tabs.Tab)

      expect(chrome.action.setIcon).calledWith({
        tabId: TAB_ID,
        path: '/img/local_resource.png'
      })
      expect(chrome.action.setTitle).calledWith({
        tabId: TAB_ID,
        title: 'tabber.tab is a local resource'
      })
    })
  })

  describe('onInstalled', () => {
    type Reason = chrome.runtime.OnInstalledReason

    it('does nothing when fired with other reason', async () => {
      queryStub.resolves([{ id: TAB_ID, url: 'http://tabber.tab' }])

      await onInstalled({ reason: 'chrome_update' as Reason })

      expect(chrome.action.setTitle).not.called
      expect(chrome.action.setIcon).not.called
    })

    it('does when there is no active tab', async () => {
      await onInstalled({ reason: 'install' as Reason })

      expect(chrome.action.setTitle).not.called
      expect(chrome.action.setIcon).not.called
    })

    it('sets flag when reason is `installed`', async () => {
      getStub.resolves({
        'tabber.tab': {
          fetched_at: new Date().getTime(),
          is_local: true
        }
      })
      queryStub.resolves([{ id: TAB_ID, url: 'http://tabber.tab' }])

      await onInstalled({ reason: 'install' as Reason })

      expect(chrome.action.setTitle).calledWith({
        tabId: TAB_ID,
        title: 'tabber.tab is a local resource'
      })
      expect(chrome.action.setIcon).calledWith({
        tabId: TAB_ID,
        path: '/img/local_resource.png'
      })
    })
  })
})
