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

export function getAnswersMultipleChoice(): AnswerOption[] {
  const optionSelectors = ['.sia-mc-option', '.sia-choice', '.mat-checkbox-layout']
  let mcOptions: NodeListOf<HTMLElement> = document.querySelectorAll('.sia-mc-option')
  for (const selector of optionSelectors) {
    const found = document.querySelectorAll(selector) as NodeListOf<HTMLElement>
    if (found.length > 0) { mcOptions = found; break }
  }
  const answers = Array.from(mcOptions).map((el, index) => {
    const letterSelectors = ['.sia-choice-letter', 'span[class*="letter"]', '.choice-label']
    let letterElement: HTMLElement | null = null
    for (const selector of letterSelectors) {
      const le = el.querySelector(selector) as HTMLElement | null
      if (le) { letterElement = le; break }
    }
    const letter = letterElement ? (letterElement.textContent || '').trim().replace(/[^A-Za-z0-9]/g, '') : String.fromCharCode(65 + index)

    let content = ''
    const labelElement = document.querySelector(`label[for="mat-checkbox-${index + 1}-input"]`) as HTMLElement | null
    if (labelElement) content = (labelElement.textContent || '').trim().replace(/^[A-Z]\.\s*/, '')
    if (!content) {
      const contentSelectors = ['.sia-mc-option-text', '.choice-text', '.mat-checkbox-label', 'span:not([class*="letter"])']
      for (const sel of contentSelectors) {
        const ce = el.querySelector(sel) as HTMLElement | null
        if (ce) { content = (ce.textContent || '').trim(); break }
      }
    }
    if (!content) content = (el.textContent || '').trim().replace(/^[A-Z]\.\s*/, '')
    if (!content || content.length < 2) content = `Option ${letter}`

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
