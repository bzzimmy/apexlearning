import type { InlineImage } from '../shared/types'

interface Args { input: string; images: InlineImage[]; apiKey: string; model: string; allowedLetters?: string[]; isMultipleChoice?: boolean }

// Returns the raw Gemini response JSON (with candidates/content/parts/text)
export async function callGemini({ input, images, apiKey, model, allowedLetters, isMultipleChoice }: Args): Promise<any> {
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const requestBody: any = {
    contents: [
      {
        parts: [{ text: input }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
      // Instruct the model to only emit JSON following our schema
      responseMimeType: 'application/json',
    },
  }

  // Add structured response schema to constrain output
  const lettersEnum = Array.isArray(allowedLetters) && allowedLetters.length > 0
    ? Array.from(new Set(allowedLetters.map((l) => String(l).toUpperCase())))
    : ['A', 'B', 'C', 'D', 'E', 'F']

  const maxItems = isMultipleChoice ? lettersEnum.length : 1

  requestBody.generationConfig.responseSchema = {
    type: 'object',
    properties: {
      letters: {
        type: 'array',
        items: { type: 'string', enum: lettersEnum },
        minItems: 1,
        maxItems,
      },
      explanation: { type: 'string' },
    },
    required: ['letters'],
    propertyOrdering: ['letters', 'explanation'],
  }

  if (images && images.length > 0) {
    for (const image of images) {
      requestBody.contents[0].parts.unshift({
        inlineData: { mimeType: image.mimeType, data: image.data },
      })
    }
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API ${response.status}: ${errorText}`)
  }
  const data = await response.json()
  return data
}
