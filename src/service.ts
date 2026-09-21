import type { Browser } from '@wxt-dev/browser'
import { setFlag as _setFlag } from './set_flag'
import { getCurrentTab } from './helpers'

async function setFlag(tab?: Pick<Browser.tabs.Tab, 'id' | 'url'>) {
  try {
    await _setFlag(tab)
  } catch (error) {
    // we care about everything but the tabs closing mid lookup
    if (!(error instanceof Error && error.message.startsWith('No tab with id')))
      throw error
  }
}

async function onUpdated(
  _tabId: number,
  { status }: { status?: string },
  tab: Browser.tabs.Tab
) {
  // 'complete' | 'loading' | undefined
  if (status) await setFlag(tab)
}

async function onActivated({ tabId }: { tabId: number }) {
  try {
    const tab = await chrome.tabs.get(tabId)
    if (tab?.url) await setFlag(tab)
  } catch {
    return
  }
}

// update flag when tab is updated — navigation, refresh, ← / →
chrome.tabs.onUpdated.addListener(onUpdated)

// update flag when tab is selected
chrome.tabs.onActivated.addListener(onActivated)

// have we been just installed? update flag then
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason != 'install') return
  await setFlag(await getCurrentTab())
})

// update the flag when user pins/unpins the page icon
chrome.action.onUserSettingsChanged.addListener(
  async () => await setFlag(await getCurrentTab())
)
