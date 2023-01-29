/* eslint-env webextensions */

import setFlag from './set_flag.js'

// update icon when tab is updated
chrome.tabs.onUpdated.addListener((tabId, { status, url } = {}, tab) => {
  // doesn't always come, on refresh doesn't
  url = tab.url
  if (url && (status === 'loading' || status === 'completed')) {
    setFlag(tab)
  }
})

// update icon when tab is selected
chrome.tabs.onActivated.addListener(activeInfo => {
  chrome.tabs.get(activeInfo.tabId, tab => {
    if (!tab || !tab.url) return

    setFlag(tab)
  })
})
