export function getQuizName(): string {
  // Try breadcrumb wrapper first
  const breadcrumbElement = document.querySelector("[class*='toolbar-title-wrapper']") as HTMLElement | null
  if (breadcrumbElement) {
    const fullText = (breadcrumbElement.textContent || '').trim()
    const quizMatch = fullText.match(/([0-9.]+\s+)?Quiz:\s*(.*)/i)
    if (quizMatch && quizMatch[2]) {
      return quizMatch[2].trim()
    }
    return fullText || 'Unknown'
  }

  // Fallback to individual elements
  const quizTypeElement = document.querySelector('.toolbar-title-type') as HTMLElement | null
  const quizTitleElement = document.querySelector('.toolbar-title') as HTMLElement | null
  if (quizTypeElement && quizTitleElement) {
    const quizTitle = (quizTitleElement.textContent || '').trim()
    return `${quizTitle}`
  }

  // Fallback to any toolbar-title
  const breadcrumbText = document.querySelector("[class*='toolbar-title']") as HTMLElement | null
  if (breadcrumbText) return (breadcrumbText.textContent || '').trim()

  return 'Unknown Quiz'
}

export function isCompleted(): boolean {
  const el = document.querySelector('.summary-title-header') as HTMLElement | null
  return !!(el && el.textContent && el.textContent.includes('Completed'))
}

export function parseProgress(): { current: number; total: number } {
  const text = (document.querySelector('.sia-question-number') as HTMLElement | null)?.innerText || ''
  const m = /Question (.*) of (.*)/.exec(text)
  return { current: m ? parseInt(m[1]) || 1 : 1, total: m ? parseInt(m[2]) || 1 : 1 }
}

export function getStatus(running: boolean) {
  const p = parseProgress()
  return {
    running,
    quizInfo: {
      name: getQuizName(),
      currentQuestion: p.current,
      totalQuestions: p.total,
      completed: isCompleted(),
    },
  }
}
