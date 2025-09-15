import type { InlineImage } from '../shared/types'

export async function captureScreen(): Promise<InlineImage[]> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'captureVisibleTab' }, (response) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message))
      if (!response?.success || !response?.dataUrl) return resolve([])
      const base64 = String(response.dataUrl).split(',')[1] || ''
      resolve(base64 ? [{ mimeType: 'image/png', data: base64 }] : [])
    })
  })
}

