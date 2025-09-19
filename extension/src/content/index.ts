/// <reference types="chrome" />
import { startAutomation, stopAutomation, isRunning } from './automation'
import { getStatus } from './core/status'
import { startStudyAutoclick } from './study'

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.action) {
    case 'startAutomation':
      startAutomation().then(sendResponse)
      return true
    case 'stopAutomation':
      sendResponse(stopAutomation())
      return false
    case 'toggleAutomation':
      // No visual feedback, per requirements
      if (isRunning()) {
        sendResponse(stopAutomation())
        return false
      } else {
        startAutomation().then(sendResponse)
        return true
      }
    case 'getStatus':
      sendResponse(getStatus(isRunning()))
      return false
    case 'autoclickStudy':
      startStudyAutoclick().then(sendResponse)
      return true
  }
})

export {}
