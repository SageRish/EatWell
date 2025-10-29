// Background service worker (MV3)
console.log('EatWell background worker loaded')

chrome.runtime.onInstalled.addListener(() => {
  console.log('EatWell installed')
})
