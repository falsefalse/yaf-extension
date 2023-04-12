import setFlag from './set_flag.js'

const onUpdated = async (
  _tabId: number,
  { status }: { status?: string },
  tab: chrome.tabs.Tab
) => {
  // 'complete' | 'loading' | undefined
  if (status) await setFlag(tab)
}

const onActivated = async ({
  tabId
}: Pick<chrome.tabs.TabActiveInfo, 'tabId'>) => {
  try {
    const tab = await chrome.tabs.get(tabId)
    if (tab?.url) await setFlag(tab)
  } catch (error) {
    return
  }
}

// update flag when tab is updated — navigation, refresh, ← / →
chrome.tabs.onUpdated.addListener(onUpdated)

// update flag when tab is selected
chrome.tabs.onActivated.addListener(onActivated)

export { onActivated, onUpdated }
