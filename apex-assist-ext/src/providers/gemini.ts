import type { InlineImage } from '../shared/types'
import { GoogleGenAI } from '@google/genai'

interface Args { input: string; images: InlineImage[]; apiKey: string; model: string; allowedLetters?: string[]; isMultipleChoice?: boolean }

// Returns the raw Gemini response JSON (with candidates/content/parts/text)
export async function callGemini({ input, images, apiKey, model, allowedLetters, isMultipleChoice }: Args): Promise<any> {
  // Use the official GenAI SDK to access the v1 contract with config.*
  const ai = new GoogleGenAI({ apiKey })
  // Model is pinned to gemini-2.5-flash below; reference to satisfy noUnusedParameters
  void model

  // Build contents with optional images first, then the text prompt
  const parts: any[] = []
  if (images && images.length > 0) {
    for (const image of images) {
      parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } })
    }
  }
  parts.push({ text: input })

  const lettersEnum = Array.isArray(allowedLetters) && allowedLetters.length > 0
    ? Array.from(new Set(allowedLetters.map((l) => String(l).toUpperCase())))
    : ['A', 'B', 'C', 'D', 'E', 'F']
  const maxItems = isMultipleChoice ? lettersEnum.length : 1

  // Always use Gemini 2.5 Flash for Gemini calls
  const modelToUse = 'gemini-2.5-flash'

  const config: any = {
    temperature: 0.2,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 8192,
    responseMimeType: 'application/json',
    responseSchema: {
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
    },
  }

  // Disable internal thinking for 2.5 models
  if (typeof modelToUse === 'string' && modelToUse.startsWith('gemini-2.5')) {
    config.thinkingConfig = { thinkingBudget: 0 }
  }

  // Perform the request using the SDK
  const resp: any = await ai.models.generateContent({
    model: modelToUse,
    contents: [
      {
        role: 'user',
        parts,
      },
    ],
    config,
  })

  // Ensure compatibility with existing parsing path (candidates[].content.parts[].text)
  if (resp && resp.candidates && Array.isArray(resp.candidates)) {
    return resp
  }
  const text = (resp && (resp.text || resp.outputText)) ? (resp.text || resp.outputText) : ''
  return {
    candidates: [
      {
        content: {
          parts: [{ text }],
        },
      },
    ],
  }
}
