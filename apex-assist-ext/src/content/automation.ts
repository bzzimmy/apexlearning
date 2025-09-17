import { captureScreen } from './images'
import { buildPrompt } from './prompt'
import { parseProgress } from './status'
import { getAnswers, getQuestion, getAnswersMultipleChoice, isMultipleChoiceQuestion } from './scrape'
import type { AnswerOption } from './scrape'
import type { Settings } from '../shared/types'
import { selectMultiple, selectSingle } from './select'
import { logger } from './logger'

let loopStopped = false
let attempts = 0
let incorrectAnswers = 0
let settings: Settings | null = null

let automationRunning = false

export async function startAutomation() {
  if (automationRunning) return { success: true }

  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
      if (response && response.settings) {
        const s: Settings = response.settings as Settings
        settings = s
        // For hybrid, defer API key selection until we know if images are used.
        if (s.provider !== 'hybrid') {
          const apiKey = s.provider === 'cerebras' ? s.cerebrasApiKey : s.geminiApiKey
          if (!apiKey) {
            console.error(`[Apex Assist] ${s.provider} API key not set. Please set it in options.`)
            resolve({ success: false, error: `${s.provider} API key not set` })
            return
          }
        }
        attempts = 0
        incorrectAnswers = 0
        loopStopped = false
        automationRunning = true
        logger.info('Automation started')
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
  logger.info('Stop requested')
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
    logger.info(`Giving up after ${attempts} attempts`)
    automationRunning = false
    return
  }
  attempts++

  const question = getQuestion()
  if (!question || question.trim().length < 1) {
    logger.warn('Cannot get question, exiting')
    automationRunning = false
    return
  }
  if (loopStopped) {
    logger.info('Loop stopped, exiting')
    automationRunning = false
    return
  }

  const isMC = isMultipleChoiceQuestion()
  const answers = isMC ? getAnswersMultipleChoice() : getAnswers()
  const progress = parseProgress()
  logger.info('Question Type Detected: ' + (isMC ? 'Multiple Choice' : 'Single Choice'))
  const images = settings?.processImages ? await captureScreen().catch(() => []) : []
  const formattedQuery = buildPrompt(question, answers)

  logger.info(`Question ${progress.current} of ${progress.total}`)
  logger.debug(formattedQuery)
  logger.info(`Images: ${images.length}`)

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
    if (!settings) throw new Error('Settings not loaded')
    // Decide provider/model/apiKey per-question (hybrid) or from settings
    let provider: 'gemini' | 'cerebras'
    let model: string
    let apiKey: string | undefined

    if (settings.provider === 'hybrid') {
      if (images.length > 0) {
        provider = 'gemini'
        model = 'gemini-2.5-flash'
        apiKey = settings.geminiApiKey
      } else {
        provider = 'cerebras'
        model = 'qwen-3-235b-a22b-instruct-2507'
        apiKey = settings.cerebrasApiKey
      }
    } else {
      provider = settings.provider === 'cerebras' ? 'cerebras' : 'gemini'
      model = settings.model
      apiKey = provider === 'cerebras' ? settings.cerebrasApiKey : settings.geminiApiKey
    }

    if (!apiKey) {
      logger.error(`Missing API key for selected provider: ${provider}. Please set it in Options.`)
      automationRunning = false
      return
    }
    logger.info('API Request sent')
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
    let answer: any
    try {
      answer = parseAIResponseText(responseText, isMC, answers)
    } catch (err) {
      // Extra diagnostics for Gemini responses to help debug formatting/safety issues
      const finish = response.candidates?.[0]?.finishReason
      const promptFeedback = response.promptFeedback
      const safety = response.candidates?.[0]?.safetyRatings
      logger.warn('[Apex Assist] Parse failed. Provider response diagnostics:')
      logger.warn(` finishReason=${String(finish || 'n/a')}; parts=${parts.length}`)
      if (promptFeedback) logger.warn(` promptFeedback=${JSON.stringify(promptFeedback)}`)
      if (safety) logger.warn(` safetyRatings=${JSON.stringify(safety)}`)
      const snippet = (responseText || '').slice(0, 400)
      logger.warn(` response snippet: ${snippet}`)
      throw err
    }
    logger.info('API Response parsed')
    if (!answer || !answer.letters || answer.letters.length === 0) {
      logger.warn('Failed to retrieve a valid answer')
      setTimeout(() => { if (automationRunning) runAutomation() }, 1000)
      return
    }

    attempts = 0
    const sabotage = shouldSabotage(progress.total)
    let lettersToSelect = answer.letters as string[]

    if (!isMC) {
      const chosen = sabotage ? answers.find((a) => a.letter !== lettersToSelect[0])?.letter || lettersToSelect[0] : lettersToSelect[0]
      if (loopStopped || !automationRunning) { logger.info('Stop detected before selection'); return }
      logger.info('Selecting answers')
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
      if (loopStopped || !automationRunning) { logger.info('Stop detected before selection'); return }
      logger.info('Selecting answers')
      await selectMultiple(answers, lettersToSelect)
    }

    // Wait before submitting
    await cancellableWait((settings.delay ?? 5) * 1000)
    if (loopStopped || !automationRunning) { logger.info('Stop detected before submit'); return }
    logger.info('Submitting answer')
    document.querySelector('kp-question-controls button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await cancellableWait(1000)

    // Check incorrect feedback
    const answerTextEl = document.querySelector('.feedback-body.active kp-feedback-header span.header-text') as HTMLElement | null
    const isIncorrect = answerTextEl?.innerText === 'Incorrect'
    if (isIncorrect) incorrectAnswers++

    // Next
    document.querySelector('kp-question-controls button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await cancellableWait(1000)

    if (automationRunning) runAutomation()
  } catch (error) {
    logger.error('Error during automation:', error)
    setTimeout(() => { if (automationRunning) runAutomation() }, 2000)
  }
}

// Wait helper that returns early if stop is requested
function cancellableWait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now()
    const iv = window.setInterval(() => {
      if (loopStopped || !automationRunning) {
        window.clearInterval(iv)
        resolve()
        return
      }
      const elapsed = Date.now() - start
      if (elapsed >= ms) {
        window.clearInterval(iv)
        resolve()
      }
    }, 50)
  })
}
