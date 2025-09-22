import type { ProviderCallArgs } from './index'

// OpenRouter provider using OpenAI-compatible Chat Completions API
// Supports optional images via image_url content parts.
export async function callOpenRouter({ input, images, apiKey, model, allowedLetters, isMultipleChoice, responseMode, sortCounts, expectedCount }: ProviderCallArgs): Promise<any> {
  const apiUrl = 'https://openrouter.ai/api/v1/chat/completions'

  const lettersEnum = Array.isArray(allowedLetters) && allowedLetters.length > 0
    ? Array.from(new Set(allowedLetters.map((l) => String(l).toUpperCase())))
    : ['A', 'B', 'C', 'D', 'E', 'F']

  const hasExact = typeof expectedCount === 'number' && expectedCount > 0
  const minItems = hasExact ? expectedCount : (isMultipleChoice ? 1 : 1)
  const maxItems = hasExact ? expectedCount : (isMultipleChoice ? lettersEnum.length : 1)

  const lettersSchema = {
    type: 'object',
    properties: {
      letters: {
        type: 'array',
        items: { type: 'string', enum: lettersEnum },
        minItems,
        maxItems,
      },
      explanation: { anyOf: [ { type: 'string' }, { type: 'null' } ] },
    },
    required: ['letters'],
    additionalProperties: false,
  }

  const rows = Math.max(1, Number(sortCounts?.rows || 10))
  const itemsCount = Math.max(1, Number(sortCounts?.items || 10))
  const sortSchema = {
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
          additionalProperties: false,
        },
        minItems: 1,
        maxItems: rows,
      },
      explanation: { anyOf: [ { type: 'string' }, { type: 'null' } ] },
    },
    required: ['pairs'],
    additionalProperties: false,
  }

  // Build content: images first, then text
  const parts: any[] = []
  if (images && images.length > 0) {
    for (const img of images) {
      const url = `data:${img.mimeType};base64,${img.data}`
      parts.push({ type: 'image_url', image_url: { url } })
    }
  }
  parts.push({ type: 'text', text: input })

  const makeBody = (fmt: any) => ({
    model,
    messages: [
      {
        role: 'user',
        content: parts,
      },
    ],
    temperature: 0.2,
    max_tokens: 1024,
    response_format: fmt,
  })

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-Title': 'Apex Assist',
  }

  // Try json_schema first
  let response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(makeBody({
      type: 'json_schema',
      json_schema: {
        name: responseMode === 'sort' ? 'sort_pairs' : 'answer_schema',
        strict: true,
        schema: responseMode === 'sort' ? sortSchema : lettersSchema,
      },
    })),
  })

  // Fallback to json_object
  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    try {
      const err = JSON.parse(errorText)
      const msg: string = String(err?.error?.message || err?.message || '')
      if (msg.includes('json_schema') || msg.includes('strict')) {
        const roBody = makeBody({ type: 'json_object' })
        response = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(roBody),
        })
        if (!response.ok) {
          const second = await response.text().catch(() => '')
          throw new Error(`OpenRouter API ${response.status}: ${second || errorText}`)
        }
      } else {
        throw new Error(`OpenRouter API ${response.status}: ${errorText}`)
      }
    } catch (e) {
      if (!(e instanceof Error)) throw new Error(`OpenRouter API ${response.status}: ${errorText}`)
    }
  }

  const data = await response.json()
  const text = data?.choices?.[0]?.message?.content ?? ''
  // Convert to Gemini-like shape for existing parsers
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
