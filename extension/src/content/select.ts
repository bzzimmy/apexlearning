import type { AnswerOption } from './scrape'

export async function selectMultiple(answers: AnswerOption[], letters: string[]) {
  // Try by letter mapping first
  let selectedAny = false
  for (const l of letters) {
    const ans = answers.find((a) => a.letter === l)
    if (ans?.select) {
      ans.select()
      selectedAny = true
      await delay(700)
    }
  }
  if (selectedAny) return

  // Fallback by checkbox index from letter
  const checkboxes = document.querySelectorAll('.mat-checkbox-input, input[type="checkbox"]')
  const indices = letters.map((letter) => letter.charCodeAt(0) - 65)
  for (const idx of indices) {
    if (idx >= 0 && idx < checkboxes.length) {
      try {
        const parent = checkboxes[idx].closest('.mat-checkbox') as HTMLElement | null
        if (parent) parent.click(); else (checkboxes[idx] as HTMLElement).click()
        await delay(700)
      } catch {}
    }
  }
}

export function selectSingle(answers: AnswerOption[], letter: string) {
  const a = answers.find((x) => x.letter === letter)
  a?.select?.()
}

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)) }
