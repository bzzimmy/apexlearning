import type { AnswerOption } from './scrape'

export function buildPrompt(question: string, answers: AnswerOption[]): string {
  return [
    question,
    '',
    'Options:',
    ...Array.from(new Set(answers.map((a) => a.value))),
  ].join('\n')
}

