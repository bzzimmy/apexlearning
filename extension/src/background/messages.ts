import type { BackgroundMessage } from '../shared/types'
import { getSettings } from './settings'
import { callProvider, testProvider } from '../providers'

export function registerMessageHandlers() {
  chrome.runtime.onMessage.addListener((message: BackgroundMessage, _sender, sendResponse) => {
    if (message.action === 'getSettings') {
      getSettings().then((settings) => sendResponse({ settings }))
      return true
    }

    if (message.action === 'captureVisibleTab') {
      // Use the overload without windowId: (options, callback)
      chrome.tabs.captureVisibleTab({ format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message })
        } else if (dataUrl) {
          sendResponse({ success: true, dataUrl })
        } else {
          sendResponse({ success: false, error: 'captureVisibleTab returned undefined dataUrl' })
        }
      })
      return true
    }

    if (message.action === 'callAIProvider') {
      const { input, images = [], provider, apiKey, model, allowedLetters, isMultipleChoice, responseMode, sortCounts, expectedCount } = message
      const p = (provider === 'gemini' || provider === 'cerebras') ? provider : 'gemini'
      callProvider({ provider: p, input, images, apiKey, model, allowedLetters, isMultipleChoice, responseMode, sortCounts, expectedCount })
        .then((data) => sendResponse({ success: true, data }))
        .catch((error) => sendResponse({ success: false, error: error?.message || String(error) }))
      return true
    }

    if (message.action === 'testProvider') {
      const { provider, apiKey, model } = message
      const p = (provider === 'gemini' || provider === 'cerebras') ? provider : 'gemini'
      testProvider({ provider: p, apiKey, model })
        .then((ok) => sendResponse({ success: ok }))
        .catch((error) => sendResponse({ success: false, error: error?.message || String(error) }))
      return true
    }

    return false
  })
}
