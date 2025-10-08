import type { AnswerOption } from '../scrape'

function coerceLettersArray(letters: any): string[] {
  if (!letters) return []
  if (Array.isArray(letters)) return letters
  if (typeof letters === 'string') {
    return letters.includes(',') ? letters.split(',').map((l) => l.trim()) : [letters]
  }
  return []
}

function mapContentToLettersIfNeeded(letters: string[], isMultipleChoice: boolean, answers: AnswerOption[]) {
  if (!isMultipleChoice || !letters) return letters || []
  const result: string[] = []
  for (const item of letters) {
    if (/^[A-F]$/i.test(item)) {
      result.push(item.toUpperCase())
    } else {
      const match = answers.find((a) => a.content.trim().toUpperCase() === (item || '').trim().toUpperCase())
      if (match) result.push(match.letter)
    }
  }
  return result
}

function extractBalancedJson(text: string): string | null {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue
    let depth = 0
    for (let j = i; j < text.length; j++) {
      const ch = text[j]
      if (ch === '{') depth++
      else if (ch === '}') depth--
      if (depth === 0) {
        const snippet = text.slice(i, j + 1)
        try {
          JSON.parse(snippet)
          return snippet
        } catch { void 0 }
        break
      }
    }
  }
  return null
}

function extractLettersFromText(text: string, answers: AnswerOption[]): string[] {
  const allowed = new Set(answers.map((a) => a.letter.toUpperCase()))
  // Look for explicit array like letters: ["A", "C"]
  const arrMatch = /letters?\s*[:=]\s*\[([^\]]+)\]/i.exec(text)
  if (arrMatch && arrMatch[1]) {
    const found = arrMatch[1]
      .split(',')
      .map((s) => s.replace(/[^A-Za-z]/g, '').toUpperCase())
      .filter((l) => allowed.has(l))
    if (found.length) return Array.from(new Set(found))
  }
  // Single-letter answer like "Answer: C" or "C."
  const singles = Array.from(text.matchAll(/\b([A-F])(?=[\s.,;!?]|$)/gi))
    .map((m) => m[1].toUpperCase())
    .filter((l) => allowed.has(l))
  if (singles.length) return Array.from(new Set(singles))
  return []
}

export function parseLettersResponseText(responseText: string, isMultipleChoice: boolean, answers: AnswerOption[]) {
  // First attempt: direct JSON.parse (structured output should return pure JSON)
  try {
    const parsed = JSON.parse(responseText)
    parsed.letters = mapContentToLettersIfNeeded(coerceLettersArray(parsed.letters), isMultipleChoice, answers)
    // Treat a well-formed JSON object as a successful parse even if it has zero letters.
    if (Array.isArray(parsed.letters)) return parsed
  } catch { void 0 }

  // Try fenced code blocks first
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(responseText)
  const candidateTexts: string[] = []
  if (fence && fence[1]) candidateTexts.push(fence[1])
  candidateTexts.push(responseText)

  // Attempt to find a balanced JSON object in any candidate text
  for (const text of candidateTexts) {
    const json = extractBalancedJson(text)
    if (json) {
      const parsed: any = JSON.parse(json)
      parsed.letters = mapContentToLettersIfNeeded(coerceLettersArray(parsed.letters), isMultipleChoice, answers)
      if (Array.isArray(parsed.letters)) return parsed
    }
  }

  // Heuristic fallback: extract letters mentioned in plain text
  const letters = extractLettersFromText(responseText, answers)
  if (letters.length) {
    return { letters }
  }
  throw new Error('Could not parse JSON from provider response')
}

export function parseSortResponseText(responseText: string): { pairs: Array<{ row: number; item: number }> } {
  // First try strict parse
  try {
    const parsed = JSON.parse(responseText)
    if (Array.isArray(parsed?.pairs)) return { pairs: parsed.pairs }
  } catch { void 0 }
  // Try fenced
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(responseText)
  const texts: string[] = []
  if (fence && fence[1]) texts.push(fence[1])
  texts.push(responseText)
  for (const t of texts) {
    const json = extractBalancedJson(t)
    if (json) {
      try {
        const parsed = JSON.parse(json)
        if (Array.isArray(parsed?.pairs)) return { pairs: parsed.pairs }
      } catch { void 0 }
    }
  }
  // Heuristic: lines like 1->3
  const pairs: Array<{ row: number; item: number }> = []
  const m = Array.from(responseText.matchAll(/(\d+)\s*(?:-|=>|->|:)?\s*(\d+)/g))
  for (const g of m) {
    const row = parseInt(g[1], 10); const item = parseInt(g[2], 10)
    if (row && item) pairs.push({ row, item })
  }
  if (pairs.length) return { pairs }
  throw new Error('Could not parse sort pairs from provider response')
}
