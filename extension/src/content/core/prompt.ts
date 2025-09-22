import type { AnswerOption } from '../scrape'

export function buildPrompt(question: string, answers: AnswerOption[]): string {
  return [
    question,
    '',
    'Options:',
    ...Array.from(new Set(answers.map((a) => a.value))),
  ].join('\n')
}

export function buildSortPrompt(
  questionStem: string,
  items: Array<{ index: number; text: string }>,
  rows: Array<{ index: number; text: string }>
): string {
  const parts: string[] = []
  parts.push(questionStem || 'Match each item to the most appropriate category.')
  parts.push('')
  parts.push('Items:')
  for (const it of items) parts.push(`${it.index}. ${it.text}`)
  parts.push('')
  parts.push('Rows to fill:')
  for (const r of rows) parts.push(`${r.index}. ${r.text}`)
  parts.push('')
  parts.push('Task: For each row, choose exactly one item number that best matches.')
  parts.push('Use each item at most once unless the UI clearly allows repeats.')
  parts.push('Respond ONLY with a single JSON object: {"pairs":[{"row":<rowNumber>,"item":<itemNumber>}, ...], "explanation":"optional"}')
  return parts.join('\n')
}

// Detect explicit answer counts like "Select the two correct answers" or "Choose 3 answers".
export function detectExactAnswerCount(stem: string): number | null {
  const s = (stem || '').toLowerCase()
  const words: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10, both: 2,
  }
  // Pattern A: "Select the two correct answers/options/choices/statements"
  const reA = /(select|choose|pick|mark|identify)\s+(?:the\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|both)\s+(?:best\s+|most\s+)?(?:correct|true)?\s*(?:answers?|options?|choices?|statements?|responses?)\b/
  let m = reA.exec(s)
  if (m) {
    const tok = m[2]
    if (tok in words) return words[tok]
    const n = parseInt(tok, 10)
    if (!Number.isNaN(n) && n > 0) return n
  }
  // Pattern B: "Choose three that apply"
  const reB = /(select|choose|pick|mark|identify)\s+(?:the\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|both)\s+that\s+apply\b/
  m = reB.exec(s)
  if (m) {
    const tok = m[2]
    if (tok in words) return words[tok]
    const n = parseInt(tok, 10)
    if (!Number.isNaN(n) && n > 0) return n
  }
  // Pattern C: "Select 2 of the following options"
  const reC = /(select|choose|pick|mark|identify)\s+(?:the\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|both)\s+(?:of|from)\s+(?:the\s+)?(?:following\s+)?(?:answers?|options?|choices?|statements?|responses?)\b/
  m = reC.exec(s)
  if (m) {
    const tok = m[2]
    if (tok in words) return words[tok]
    const n = parseInt(tok, 10)
    if (!Number.isNaN(n) && n > 0) return n
  }
  return null
}
