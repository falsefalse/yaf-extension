/* eslint-env webextensions */

import setFlag from './set_flag.js'

async function getTabById(tabId: number | undefined) {
  if (!tabId) return

  let tab

  try {
    tab = await chrome.tabs.get(tabId)
  } catch (error) {
    return
  }

  return tab
}

// update icon when tab is updated
chrome.tabs.onUpdated.addListener(
  async (tabId, { status, url }, receivedTab) => {
    // doesn't always come, on refresh doesn't
    url = url || receivedTab.url

    if (url && (status === 'loading' || status === 'complete')) {
      const tab = await getTabById(receivedTab.id)

      if (tab) await setFlag(tab)
    }
  }
)

// update icon when tab is selected
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await getTabById(tabId)

  if (tab?.url) await setFlag(tab)
})
