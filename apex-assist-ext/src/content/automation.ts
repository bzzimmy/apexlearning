import { captureScreen } from './images'
import { buildPrompt } from './prompt'
import { parseProgress } from './status'
import { getAnswers, getQuestion, getAnswersMultipleChoice, isMultipleChoiceQuestion } from './scrape'
import type { AnswerOption } from './scrape'
import { selectMultiple, selectSingle } from './select'

let loopStopped = false
let attempts = 0
let incorrectAnswers = 0
let settings: any = null

let automationRunning = false

export async function startAutomation() {
  if (automationRunning) return { success: true }

  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
      if (response && response.settings) {
        settings = response.settings
        const apiKey = settings.provider === 'cerebras' ? settings.cerebrasApiKey : settings.geminiApiKey
        if (!apiKey) {
          console.error(`[Apex Assist] ${settings.provider} API key not set. Please set it in options.`)
          resolve({ success: false, error: `${settings.provider} API key not set` })
          return
        }
        attempts = 0
        incorrectAnswers = 0
        loopStopped = false
        automationRunning = true
        runAutomation()
        resolve({ success: true })
      } else {
        resolve({ success: false, error: 'Could not load settings' })
      }
    })
  })
}

export function stopAutomation() {
  loopStopped = true
  automationRunning = false
  return { success: true }
}

export function isRunning() { return automationRunning }

// Parse model output JSON from text
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

function parseAIResponseText(responseText: string, isMultipleChoice: boolean, answers: AnswerOption[]) {
  // First attempt: direct JSON.parse (structured output should return pure JSON)
  try {
    const parsed = JSON.parse(responseText)
    parsed.letters = mapContentToLettersIfNeeded(coerceLettersArray(parsed.letters), isMultipleChoice, answers)
    if (parsed.letters?.length) return parsed
  } catch {}

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
      if (parsed.letters?.length) return parsed
    }
  }

  // Heuristic fallback: extract letters mentioned in plain text
  const letters = extractLettersFromText(responseText, answers)
  if (letters.length) {
    return { letters }
  }

  throw new Error('Could not parse JSON from provider response')
}

// Find a balanced JSON object substring starting at any '{'
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
        } catch {}
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
  const singles = Array.from(text.matchAll(/\b([A-F])(?=[\s\.,;!\?]|$)/gi))
    .map((m) => m[1].toUpperCase())
    .filter((l) => allowed.has(l))
  if (singles.length) return Array.from(new Set(singles))
  return []
}

function shouldSabotage(totalQuestions: number) {
  if (!settings?.sabotage) return false
  if (totalQuestions <= settings.incorrectCount) return false
  if (incorrectAnswers >= settings.incorrectCount) return false
  return Math.random() < 0.4
}

async function runAutomation() {
  if (attempts >= (settings?.attempts ?? 3)) {
    console.log(`[Apex Assist] Giving up after ${attempts} attempts`)
    automationRunning = false
    return
  }
  attempts++

  const question = getQuestion()
  if (!question || question.trim().length < 1) {
    console.log('[Apex Assist] Cannot get question, exiting')
    automationRunning = false
    return
  }
  if (loopStopped) {
    console.log('[Apex Assist] Loop forcefully stopped, exiting')
    automationRunning = false
    return
  }

  const isMC = isMultipleChoiceQuestion()
  const answers = isMC ? getAnswersMultipleChoice() : getAnswers()
  const progress = parseProgress()
  const images = settings?.processImages ? await captureScreen().catch(() => []) : []
  const formattedQuery = buildPrompt(question, answers)

  console.log(`[Apex Assist] Question ${progress.current} of ${progress.total}`)
  console.log(formattedQuery)
  console.log(`[Apex Assist] Images: ${images.length}`)
  console.log(`[Apex Assist] Multiple Choice: ${isMC}`)

  // Build AI input with instructions
  let input = `${formattedQuery}\n\n`
  if (images.length > 0) {
    input += 'Note: An image of the entire screen is provided. Analyze the visual context with the text.\n\n'
  }
  if (isMC) {
    input += 'Task: This is a multiple-choice question where MULTIPLE answers can be correct. You MUST identify ALL correct options.\n'
    input += 'Return ALL correct options in an array, even if there are multiple correct answers.\n'
    input += 'Provide your answer in the format: {"letters": ["A", "C"], "explanation": "[Few words why]"}\n'
    input += 'IMPORTANT: Use ONLY option letters (A, B, C, etc.).\n'
    input += 'Respond ONLY with a single JSON object as described. Do not include any other text.\n'
    input += '\nFor reference, here are the options:\n'
    answers.forEach((a) => { input += `${a.letter}. ${a.content}\n` })
  } else {
    input += 'Task: Identify the single best option. Provide your answer in the format: {"letters": ["A"], "explanation": "[Few words why]"}\n'
    input += 'Respond ONLY with a single JSON object as described. Do not include any other text.\n'
  }

  try {
    const apiKey = settings.provider === 'cerebras' ? settings.cerebrasApiKey : settings.geminiApiKey
    const provider = settings.provider
    const model = settings.model
    const response: any = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'callAIProvider', input, images, provider, apiKey, model, allowedLetters: answers.map(a => a.letter), isMultipleChoice: isMC },
        (res) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message))
          if (!res?.success) return reject(new Error(res?.error || 'Unknown provider error'))
          resolve(res.data)
        }
      )
    })

    // Concatenate all text parts for robustness
    const parts = response.candidates?.[0]?.content?.parts || []
    const responseText = parts.map((p: any) => p?.text || '').join('\n')
    const answer = parseAIResponseText(responseText, isMC, answers)
    console.log('[Apex Assist] Answer result:', answer)
    if (!answer || !answer.letters || answer.letters.length === 0) {
      console.log('[Apex Assist] Failed to retrieve a valid answer')
      setTimeout(() => runAutomation(), 1000)
      return
    }

    attempts = 0
    const sabotage = shouldSabotage(progress.total)
    let lettersToSelect = answer.letters as string[]

    if (!isMC) {
      const chosen = sabotage ? answers.find((a) => a.letter !== lettersToSelect[0])?.letter || lettersToSelect[0] : lettersToSelect[0]
      selectSingle(answers, chosen)
    } else {
      if (sabotage) {
        const setCorrect = new Set(lettersToSelect)
        const allLetters = answers.map((a) => a.letter)
        const incorrect = allLetters.filter((l) => !setCorrect.has(l))
        if (lettersToSelect.length > 0) {
          lettersToSelect = [lettersToSelect[0], ...incorrect.slice(0, 1)]
        }
      }
      await selectMultiple(answers, lettersToSelect)
    }

    // Wait before submitting
    await new Promise((r) => setTimeout(r, (settings.delay ?? 5) * 1000))
    document.querySelector('kp-question-controls button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 1000))

    // Check incorrect feedback
    const answerTextEl = document.querySelector('.feedback-body.active kp-feedback-header span.header-text') as HTMLElement | null
    const isIncorrect = answerTextEl?.innerText === 'Incorrect'
    if (isIncorrect) incorrectAnswers++

    // Next
    document.querySelector('kp-question-controls button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 1000))

    if (automationRunning) runAutomation()
  } catch (error) {
    console.error('[Apex Assist] Error during automation:', error)
    setTimeout(() => { if (automationRunning) runAutomation() }, 2000)
  }
}
