/// <reference types="chrome" />
import { registerMessageHandlers } from './messages'
import { ensureDefaultSettings } from './settings'

// Setup on install
chrome.runtime.onInstalled.addListener(() => {
  ensureDefaultSettings()
})

// Hotkey toggle relays to content script
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-automation') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0]
      if (!tab?.id || !tab.url) return
      if (tab.url.includes('apexvs.com') || tab.url.includes('course.apexlearning.com')) {
        chrome.tabs.sendMessage(tab.id, { action: 'toggleAutomation' })
      }
    })
  }
})

// Messages from content/popup
registerMessageHandlers()

export {}

