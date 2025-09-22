import { captureScreen, questionHasInlineMedia } from './core/images'
import { buildPrompt, buildSortPrompt, detectExactAnswerCount } from './core/prompt'
import { parseProgress, isCompleted } from './core/status'
import { getAnswers, getQuestion, getAnswersMultipleChoice } from './scrape'
import { getSortItems, getSortSlots, performSortPairs } from './sort'
import type { AnswerOption } from './scrape'
import type { Settings } from '../shared/types'
import { selectMultiple, selectSingle } from './core/select'
import { logger } from './logger'
import { detectQuestionType } from './core/detect'
import { parseLettersResponseText, parseSortResponseText } from './core/parsing'
import { chooseProvider } from './core/providerRouter'

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

  // If the quiz shows a completion/summary screen, stop quietly.
  if (isCompleted()) {
    logger.info('Quiz is completed — stopping automation')
    automationRunning = false
    return
  }

  const question = getQuestion()
  if (!question || question.trim().length < 1) {
    // On some completion views there is no question element; treat as a normal stop.
    logger.info('No question detected — stopping automation')
    automationRunning = false
    return
  }
  if (loopStopped) {
    logger.info('Loop stopped, exiting')
    automationRunning = false
    return
  }

  const qType = detectQuestionType()
  const isSort = qType === 'sort'
  const isMC = qType === 'multiple'
  const answers = isSort ? [] as AnswerOption[] : (isMC ? getAnswersMultipleChoice() : getAnswers())
  const progress = parseProgress()
  logger.info('Question Type Detected: ' + (isSort ? 'Sort' : (isMC ? 'Multiple Choice' : 'Single Choice')))
  const hasInlineMedia = settings?.processImages ? questionHasInlineMedia() : false
  const images = hasInlineMedia ? await captureScreen().catch(() => []) : []
  let formattedQuery = ''
  if (isSort) {
    const items = getSortItems()
    const slots = getSortSlots()
    formattedQuery = buildSortPrompt(
      question,
      items.map((i, idx) => ({ index: idx + 1, text: i.text })),
      slots.map((s, idx) => ({ index: idx + 1, text: s.context }))
    )
  } else {
    formattedQuery = buildPrompt(question, answers)
  }

  logger.info(`Question ${progress.current} of ${progress.total}`)
  logger.debug(formattedQuery)
  logger.info(`Images: ${images.length}`)
  if (settings?.provider === 'hybrid') {
    logger.info(`Inline media detected: ${hasInlineMedia}`)
  }

  // Build AI input with instructions
  let input = `${formattedQuery}\n\n`
  if (images.length > 0) {
    input += 'Note: An image of the entire screen is provided. Analyze the visual context with the text.\n\n'
  }
  const exactCount = isMC ? detectExactAnswerCount(question) : null
  if (!isSort && isMC) {
    input += 'Task: This is a multiple-choice question where MULTIPLE answers can be correct. You MUST identify ALL correct options.\n'
    if (typeof exactCount === 'number') {
      input += `Exactly ${exactCount} answers are correct. Return exactly ${exactCount} letters.\n`
    } else {
      input += 'Return ALL correct options in an array, even if there are multiple correct answers.\n'
    }
    input += 'Provide your answer in the format: {"letters": ["A", "C"], "explanation": "[Few words why]"}\n'
    input += 'IMPORTANT: Use ONLY option letters (A, B, C, etc.).\n'
    input += 'Respond ONLY with a single JSON object as described. Do not include any other text.\n'
    input += '\nFor reference, here are the options:\n'
    answers.forEach((a) => { input += `${a.letter}. ${a.content}\n` })
  } else if (!isSort) {
    input += 'Task: Identify the single best option. Provide your answer in the format: {"letters": ["A"], "explanation": "[Few words why]"}\n'
    input += 'Respond ONLY with a single JSON object as described. Do not include any other text.\n'
  }

  try {
    if (!settings) throw new Error('Settings not loaded')
    // Decide provider/model/apiKey per-question (hybrid) or from settings
    let provider: 'gemini' | 'cerebras' | 'openrouter'
    let model: string
    let apiKey: string | undefined

    const choice = chooseProvider(settings, images.length > 0)
    provider = choice.provider
    model = choice.model
    apiKey = choice.apiKey
    if (settings.provider === 'hybrid') {
      logger.info(`Model selected: ${model} (${provider})`)
    }

    if (!apiKey) {
      logger.error(`Missing API key for selected provider: ${provider}. Please set it in Options.`)
      automationRunning = false
      return
    }
    logger.info('API Request sent')
    const response: any = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: 'callAIProvider',
          input,
          images,
          provider,
          apiKey,
          model,
          allowedLetters: isSort ? undefined : answers.map(a => a.letter),
          isMultipleChoice: isMC,
          responseMode: isSort ? 'sort' : 'letters',
          sortCounts: isSort ? { rows: getSortSlots().length, items: getSortItems().length } : undefined,
          expectedCount: typeof exactCount === 'number' ? exactCount : undefined,
        },
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
    if (isSort) {
      let pairs: Array<{ row: number; item: number }>
      try {
        pairs = parseSortResponseText(responseText).pairs
      } catch (err) {
        const finish = response.candidates?.[0]?.finishReason
        const promptFeedback = response.promptFeedback
        const safety = response.candidates?.[0]?.safetyRatings
        logger.warn('[Apex Assist] Sort parse failed diagnostics:')
        logger.warn(` finishReason=${String(finish || 'n/a')}; parts=${parts.length}`)
        if (promptFeedback) logger.warn(` promptFeedback=${JSON.stringify(promptFeedback)}`)
        if (safety) logger.warn(` safetyRatings=${JSON.stringify(safety)}`)
        const snippet = (responseText || '').slice(0, 400)
        logger.warn(` response snippet: ${snippet}`)
        throw err
      }
      if (!pairs?.length) {
        logger.warn('No sort pairs returned')
        setTimeout(() => { if (automationRunning) runAutomation() }, 1000)
        return
      }
      if (loopStopped || !automationRunning) { logger.info('Stop detected before selection'); return }
      logger.info('Placing items')
      const items = getSortItems()
      const slots = getSortSlots()
      await performSortPairs(pairs, items, slots)
    } else {
      let answer: any
      try {
        answer = parseLettersResponseText(responseText, isMC, answers)
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
