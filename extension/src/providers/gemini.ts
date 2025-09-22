import type { ProviderCallArgs } from './index'
import { GoogleGenAI } from '@google/genai'

// Returns the raw Gemini response JSON (with candidates/content/parts/text)
export async function callGemini({ input, images, apiKey, model, allowedLetters, isMultipleChoice, responseMode, sortCounts, expectedCount }: ProviderCallArgs): Promise<any> {
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
  const hasExact = typeof expectedCount === 'number' && expectedCount > 0
  const minItems = hasExact ? expectedCount : (isMultipleChoice ? 1 : 1)
  const maxItems = hasExact ? expectedCount : (isMultipleChoice ? lettersEnum.length : 1)

  // Always use Gemini 2.5 Flash for Gemini calls
  const modelToUse = 'gemini-2.5-flash'

  const config: any = {
    temperature: 0.2,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 8192,
  }

  if (responseMode === 'sort') {
    // Structured schema for sort mapping
    const rows = Math.max(1, Number(sortCounts?.rows || 10))
    const itemsCount = Math.max(1, Number(sortCounts?.items || 10))
    config.responseMimeType = 'application/json'
    config.responseSchema = {
      type: 'object',
      properties: {
        pairs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              row: { type: 'integer', minimum: 1, maximum: rows },
              item: { type: 'integer', minimum: 1, maximum: itemsCount },
            },
            required: ['row', 'item'],
            // Keep key order stable (supported)
            propertyOrdering: ['row', 'item'],
          },
          minItems: 1,
          maxItems: rows,
        },
        // Optional; omit from required (no anyOf/null)
        explanation: { type: 'string' },
      },
      required: ['pairs'],
      // Supported; helpful for deterministic order
      propertyOrdering: ['pairs', 'explanation'],
    }
  } else {
    config.responseMimeType = 'application/json'
    config.responseSchema = {
      type: 'object',
      properties: {
        letters: {
          type: 'array',
          items: { type: 'string', enum: lettersEnum },
          minItems,
          maxItems,
        },
        // Optional; omit from required
        explanation: { type: 'string' },
      },
      required: ['letters'],
      propertyOrdering: ['letters', 'explanation'],
    }
  }

  // Disable internal thinking for 2.5 Flash models (Pro cannot be disabled)
  if (typeof modelToUse === 'string' && modelToUse.startsWith('gemini-2.5-flash')) {
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
