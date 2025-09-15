import type { Settings } from '../shared/types'

export const DEFAULT_SETTINGS: Settings = {
  provider: 'gemini',
  geminiApiKey: '',
  cerebrasApiKey: '',
  model: 'gemini-2.5-flash',
  delay: 5,
  sabotage: true,
  incorrectCount: 2,
  attempts: 3,
  processImages: true,
}

export function ensureDefaultSettings() {
  chrome.storage.sync.get('settings', (result) => {
    if (!result.settings) {
      chrome.storage.sync.set({ settings: DEFAULT_SETTINGS })
    }
  })
}

export function getSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get('settings', (data) => {
      resolve({ ...DEFAULT_SETTINGS, ...(data.settings || {}) })
    })
  })
}

