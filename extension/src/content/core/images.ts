import type { InlineImage } from '../../shared/types'

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

// Lightweight detector to see if the current question likely contains inline media
// Scans the question stem and nearby answer container for <img>/<svg>/<canvas>/<video>/<picture>
// and significant CSS background-images. Returns true if any are found.
export function questionHasInlineMedia(): boolean {
  const roots: Element[] = []
  const stem = document.querySelector('.sia-question-stem')
  if (stem) roots.push(stem)

  // Try to include an answers container near the first option
  const option = document.querySelector(
    '.sia-mc-option, .sia-choice, .mat-checkbox-layout, .choice-item'
  ) as HTMLElement | null
  if (option) {
    const answersRoot = (option.closest(
      '.sia-mc-options, .choices, .kp-question, .question, .assessment-question, .question-content'
    ) as Element | null) || option.parentElement
    if (answersRoot) roots.push(answersRoot)
  }

  // Helper utilities for visibility/size checks
  const MIN_DIM = 96
  const isVisible = (el: HTMLElement) => {
    const cs = window.getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity || '1') === 0) return false
    const r = el.getBoundingClientRect()
    return r.width >= 1 && r.height >= 1
  }
  const passesSize = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    return Math.min(r.width, r.height) >= MIN_DIM
  }

  const hasMediaIn = (root: Element) => {
    // Direct media elements (exclude svg to avoid icons)
    const media = Array.from(root.querySelectorAll<HTMLElement>('img, canvas, video, picture'))
    for (const el of media) {
      if (!isVisible(el)) continue
      if (el.tagName.toLowerCase() === 'img') {
        const img = el as HTMLImageElement
        const natOk = (img.naturalWidth || 0) >= MIN_DIM && (img.naturalHeight || 0) >= MIN_DIM
        if (natOk) return true
      }
      if (passesSize(el)) return true
    }

    // Check for significant CSS background images on a limited subset of elements
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('*')).slice(0, 300)
    for (const el of nodes) {
      const style = window.getComputedStyle(el)
      const bg = style.backgroundImage
      if (bg && bg !== 'none' && bg.includes('url(')) {
        const rect = el.getBoundingClientRect()
        if (rect.width >= 48 && rect.height >= 48) return true
      }
    }
    return false
  }

  for (const r of roots) {
    try {
      if (r && hasMediaIn(r)) return true
    } catch { void 0 }
  }
  return false
}
