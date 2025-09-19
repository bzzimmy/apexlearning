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
