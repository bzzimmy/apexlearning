import { isSortQuestion } from '../sort'
import { isMultipleChoiceQuestion } from '../scrape'

export type QuestionType = 'single' | 'multiple' | 'sort'

export function detectQuestionType(): QuestionType {
  try {
    if (isSortQuestion()) return 'sort'
  } catch {}
  try {
    if (isMultipleChoiceQuestion()) return 'multiple'
  } catch {}
  return 'single'
}
