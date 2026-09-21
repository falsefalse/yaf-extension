import { fakeBrowser } from '@webext-core/fake-browser'
import { currentTab, firePinnedChange, tab } from './setup'

import '../src/service'

const TAB_ID = 1312

const { setTitle, setIcon } = chrome.action
const { onUpdated, onActivated } = fakeBrowser.tabs
const { onInstalled } = fakeBrowser.runtime

// same callback overload story as `tabs.query`, see setup
const tabById = (fields: Parameters<typeof tab>[0]) =>
  vi.spyOn(chrome.tabs, 'get').mockImplementation(async () => tab(fields))

describe('service.ts', () => {
  it('assigns event listeners', () => {
    expect(onUpdated.hasListeners()).toBe(true)
    expect(onActivated.hasListeners()).toBe(true)
    expect(onInstalled.hasListeners()).toBe(true)
  })

  describe('onActivated', () => {
    const activate = () => onActivated.trigger({ tabId: TAB_ID, windowId: 1 })

    it('sets the flag', async () => {
      tabById({ id: TAB_ID, url: 'http://tab.bo' })
      await chrome.storage.local.set({
        'tab.bo': { fetched_at: Date.now(), is_local: true }
      })

      await activate()

      expect(setIcon).toHaveBeenCalledWith(
        { tabId: TAB_ID, path: '/img/local_resource.png' },
        expect.any(Function)
      )
      expect(setTitle).toHaveBeenCalledWith({
        tabId: TAB_ID,
        title: 'tab.bo is a local resource'
      })
    })

    it('does nothing if tab is not there', async () => {
      // chrome rejects instead, but the code guards against both
      vi.spyOn(chrome.tabs, 'get').mockResolvedValue(undefined)

      await activate()

      expect(setIcon).not.toHaveBeenCalled()
      expect(setTitle).not.toHaveBeenCalled()
    })

    it('does nothing if tabs.get throws', async () => {
      vi.spyOn(chrome.tabs, 'get').mockRejectedValue(new Error('No tab'))

      await activate()

      expect(setIcon).not.toHaveBeenCalled()
      expect(setTitle).not.toHaveBeenCalled()
    })

    it('does nothing if tab has no url', async () => {
      tabById({ id: TAB_ID })

      await activate()

      expect(setIcon).not.toHaveBeenCalled()
      expect(setTitle).not.toHaveBeenCalled()
    })
  })

  describe('onUpdated', () => {
    it('does nothing if status is undefined', async () => {
      await onUpdated.trigger(0, { status: undefined }, tab({}))

      expect(setIcon).not.toHaveBeenCalled()
      expect(setTitle).not.toHaveBeenCalled()
    })

    it('sets flag', async () => {
      await chrome.storage.local.set({
        'tabber.tab': { fetched_at: Date.now(), is_local: true }
      })

      await onUpdated.trigger(
        TAB_ID,
        { status: 'complete' },
        tab({ id: TAB_ID, url: 'http://tabber.tab' })
      )

      expect(setIcon).toHaveBeenCalledWith(
        { tabId: TAB_ID, path: '/img/local_resource.png' },
        expect.any(Function)
      )
      expect(setTitle).toHaveBeenCalledWith({
        tabId: TAB_ID,
        title: 'tabber.tab is a local resource'
      })
    })

    describe('when the tab closes mid-lookup', () => {
      const updateClosedTab = async (error: Error) => {
        await chrome.storage.local.set({
          'tabber.tab': { fetched_at: Date.now(), is_local: true }
        })
        vi.mocked(setTitle).mockImplementation(async () => {
          throw error
        })

        return onUpdated.trigger(
          TAB_ID,
          { status: 'complete' },
          tab({ id: TAB_ID, url: 'http://tabber.tab' })
        )
      }

      it('shrugs the failure off', async () => {
        await expect(
          updateClosedTab(new Error(`No tab with id: ${TAB_ID}.`))
        ).resolves.toBeDefined()
      })

      it('lets any other failure through', async () => {
        await expect(updateClosedTab(new Error('boop'))).rejects.toThrow('boop')
      })
    })
  })

  describe('onInstalled', () => {
    it('does nothing when fired with other reason', async () => {
      currentTab({ id: TAB_ID, url: 'http://tabber.tab' })

      await onInstalled.trigger({ reason: 'chrome_update' })

      expect(setTitle).not.toHaveBeenCalled()
      expect(setIcon).not.toHaveBeenCalled()
    })

    it('does nothing when there is no active tab', async () => {
      await onInstalled.trigger({ reason: 'install' })

      expect(setTitle).not.toHaveBeenCalled()
      expect(setIcon).not.toHaveBeenCalled()
    })

    it('sets flag when reason is `install`', async () => {
      await chrome.storage.local.set({
        'tabber.tab': { fetched_at: Date.now(), is_local: true }
      })
      currentTab({ id: TAB_ID, url: 'http://tabber.tab' })

      await onInstalled.trigger({ reason: 'install' })

      expect(setTitle).toHaveBeenCalledWith({
        tabId: TAB_ID,
        title: 'tabber.tab is a local resource'
      })
      expect(setIcon).toHaveBeenCalledWith(
        { tabId: TAB_ID, path: '/img/local_resource.png' },
        expect.any(Function)
      )
    })
  })

  describe('onUserSettingsChanged', () => {
    it('sets flag on the current tab when pinned or unpinned', async () => {
      await chrome.storage.local.set({
        'tabber.tab': { fetched_at: Date.now(), is_local: true }
      })
      currentTab({ id: TAB_ID, url: 'http://tabber.tab' })

      await firePinnedChange(true)

      expect(setTitle).toHaveBeenCalledWith({
        tabId: TAB_ID,
        title: 'tabber.tab is a local resource'
      })
      expect(setIcon).toHaveBeenCalledWith(
        { tabId: TAB_ID, path: '/img/local_resource.png' },
        expect.any(Function)
      )
    })
  })
})
