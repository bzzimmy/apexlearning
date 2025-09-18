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

  // Generic question wrapper fallbacks
  const wrapper = document.querySelector(
    '.kp-question, .assessment-question, .sia-question, .question-content'
  )
  if (wrapper) roots.push(wrapper)

  const hasMediaIn = (root: Element) => {
    // Direct media elements
    if (root.querySelector('img, svg, canvas, video, picture')) return true

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
    } catch {}
  }
  return false
}
