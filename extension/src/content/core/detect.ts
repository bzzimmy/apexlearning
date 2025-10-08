import { isSortQuestion } from '../sort'
import { isMultipleChoiceQuestion } from '../scrape'

export type QuestionType = 'single' | 'multiple' | 'sort'

export function detectQuestionType(): QuestionType {
  try {
    if (isSortQuestion()) return 'sort'
  } catch { void 0 }
  try {
    if (isMultipleChoiceQuestion()) return 'multiple'
  } catch { void 0 }
  return 'single'
}
