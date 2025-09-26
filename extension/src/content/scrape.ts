export interface AnswerOption {
  value: string
  letter: string
  content: string
  select?: () => void
}

export function getQuestion(): string {
  const el = document.querySelector('.sia-question-stem') as HTMLElement | null
  return el?.innerText?.trim() || ''
}

export function getAnswers(): AnswerOption[] {
  // Skeleton: attempt single-choice style
  const labels = Array.from(document.querySelectorAll('.sia-input .label')) as HTMLElement[]
  return labels
    .map((el) => {
      const value = (el.querySelector('.label')?.textContent || '').replaceAll('\n', '')
      const letter = value.charAt(0).toUpperCase()
      return {
        value,
        letter,
        content: value.substring(3).trim(),
        select: () => (el as HTMLElement).click(),
      }
    })
    .filter((a) => a.value.trim().length > 0)
}

export function isMultipleChoiceQuestion(): boolean {
  const checkboxes = document.querySelectorAll('.mat-checkbox-input')
  return checkboxes.length > 0
}

// Extract the human-visible statement for a multiple-choice option element.
function extractOptionText(el: HTMLElement): string {
  // Work on a clone so we don't mutate the DOM
  const clone = el.cloneNode(true) as HTMLElement

  // Remove obvious non-text/letter/decorative nodes
  const junkSelectors = [
    '.sia-choice-letter', '.choice-label',
    'input', '.mat-checkbox', 'svg', 'button', '[role="img"]',
    '[aria-hidden="true"]'
  ]
  for (const sel of junkSelectors) {
    clone.querySelectorAll(sel).forEach(n => n.remove())
  }

  // Prefer known text containers
  const primary = clone.querySelector(
    '.sia-mc-option-text, .choice-text, .mat-checkbox-label, .kp-choice-text, [data-test="option-text"]'
  ) as HTMLElement | null

  let text = (primary?.innerText || clone.innerText || '')
    .replace(/^[A-Z]\.[\s\u00A0]*/, '') // strip leading "A. " if present
    .replace(/\s+/g, ' ')
    .trim()

  // Fallback to aria-label if still empty
  if (!text || text.length < 3) {
    const aria = el.getAttribute('aria-label') || clone.getAttribute('aria-label')
    if (aria && aria.length > 3) text = aria.trim()
  }

  return text
}

export function getAnswersMultipleChoice(): AnswerOption[] {
  const optionSelectors = ['.sia-mc-option', '.sia-choice', '.mat-checkbox-layout']
  let mcOptions: NodeListOf<HTMLElement> = document.querySelectorAll('.sia-mc-option')
  for (const selector of optionSelectors) {
    const found = document.querySelectorAll(selector) as NodeListOf<HTMLElement>
    if (found.length > 0) { mcOptions = found; break }
  }
  const answers = Array.from(mcOptions).map((el, index) => {
    // Letter detection
    const letterSelectors = ['.sia-choice-letter', 'span[class*="letter"]', '.choice-label']
    let letterElement: HTMLElement | null = null
    for (const selector of letterSelectors) {
      const le = el.querySelector(selector) as HTMLElement | null
      if (le) { letterElement = le; break }
    }
    const letter = letterElement ? (letterElement.textContent || '').trim().replace(/[^A-Za-z0-9]/g, '') : String.fromCharCode(65 + index)

    // Robust text extraction
    let content = extractOptionText(el)

    // Reference to input element for associated label/aria
    const inputElRef = (el.querySelector('input[type="checkbox"], .mat-checkbox-input') as HTMLInputElement | null) || (el.closest('.mat-checkbox')?.querySelector('input[type="checkbox"], .mat-checkbox-input') as HTMLInputElement | null)

    // Fallback A: look for an associated label[for=<input id>]
    if (!content || content.length < 3) {
      const id = inputElRef?.id || inputElRef?.getAttribute('id') || ''
      if (id) {
        try {
          const esc = (window as any).CSS && (window as any).CSS.escape ? (window as any).CSS.escape(id) : id.replace(/[^A-Za-z0-9_:\-]/g, '')
          const lab = document.querySelector(`label[for="${esc}"]`) as HTMLElement | null
          if (lab) content = (lab.innerText || lab.textContent || '').trim()
        } catch {}
      }
    }

    // Fallback B: aria-labelledby (points to external text element)
    if (!content || content.length < 3) {
      const labelledBy = inputElRef?.getAttribute('aria-labelledby') || ''
      if (labelledBy) {
        const ids = labelledBy.split(/\s+/).filter(Boolean)
        const texts: string[] = []
        for (const id2 of ids) {
          try {
            const esc2 = (window as any).CSS && (window as any).CSS.escape ? (window as any).CSS.escape(id2) : id2.replace(/[^A-Za-z0-9_:\-]/g, '')
            const node = document.getElementById(esc2) as HTMLElement | null
            const t = (node?.innerText || node?.textContent || '').trim()
            if (t) texts.push(t)
          } catch {}
        }
        if (texts.length) content = texts.join(' ')
      }
    }

    // Fallback C: aria-labels on node/ancestors
    if (!content || content.length < 3) {
      const aria = el.getAttribute('aria-label') || el.closest('[aria-label]')?.getAttribute('aria-label') || ''
      if (aria && aria.length > 3) content = aria.trim()
    }

    // Final fallback to visible text
    if (!content || content.length < 3) {
      content = (el.textContent || '').trim().replace(/^[A-Z]\.[\s\u00A0]*/, '')
    }

    if (!content || content.length < 2) content = `Option ${letter}`

    // Click target
    let checkbox: HTMLElement | null = null
    const checkboxSelectors = ['.mat-checkbox', 'input[type="checkbox"]', '.checkbox']
    for (const sel of checkboxSelectors) {
      const c = (el.querySelector(sel) as HTMLElement | null) || el.closest(sel) as HTMLElement | null
      if (c) { checkbox = c; break }
    }
    if (!checkbox) checkbox = el

    return {
      value: `${letter}. ${content}`,
      letter,
      content,
      select: () => {
        try { checkbox!.click() } catch {}
      },
    }
  })
  return answers
}
