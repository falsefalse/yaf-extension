import { setFlag } from './set_flag.js'

async function onUpdated(
  _tabId: number,
  { status }: { status?: string },
  tab: chrome.tabs.Tab
) {
  // 'complete' | 'loading' | undefined
  if (status) await setFlag(tab)
}

async function onActivated({
  tabId
}: Pick<chrome.tabs.TabActiveInfo, 'tabId'>) {
  try {
    const tab = await chrome.tabs.get(tabId)
    if (tab?.url) await setFlag(tab)
  } catch (error) {
    return
  }
}

async function onInstalled({
  reason
}: Pick<chrome.runtime.InstalledDetails, 'reason'>) {
  if (reason != 'install') return

  const [currentTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  })

  if (!currentTab) return

  await setFlag(currentTab)
}

// update flag when tab is updated — navigation, refresh, ← / →
chrome.tabs.onUpdated.addListener(onUpdated)

// update flag when tab is selected
chrome.tabs.onActivated.addListener(onActivated)

// have we been just installed? update flag then
chrome.runtime.onInstalled.addListener(onInstalled)

export { onActivated, onUpdated, onInstalled }
