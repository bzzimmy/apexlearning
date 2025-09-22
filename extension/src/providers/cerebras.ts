import type { ProviderCallArgs } from './index'

// Returns a Gemini-like response shape so content parsing stays unified
export async function callCerebras({ input, images, apiKey, model, allowedLetters, isMultipleChoice, responseMode, sortCounts, expectedCount }: ProviderCallArgs): Promise<any> {
  if (images && images.length > 0) {
    console.log('[Cerebras] Warning: images are ignored by Cerebras in this flow')
  }

  const apiUrl = 'https://api.cerebras.ai/v1/chat/completions'

  const lettersEnum = Array.isArray(allowedLetters) && allowedLetters.length > 0
    ? Array.from(new Set(allowedLetters.map((l) => String(l).toUpperCase())))
    : ['A', 'B', 'C', 'D', 'E', 'F']
  const hasExact = typeof expectedCount === 'number' && expectedCount > 0
  const minItems = hasExact ? expectedCount : (isMultipleChoice ? 1 : 1)
  const maxItems = hasExact ? expectedCount : (isMultipleChoice ? lettersEnum.length : 1)

  // Structured outputs via json_schema (strict)
  const response_format = (() => {
    if (responseMode === 'sort') {
      const rows = Math.max(1, Number(sortCounts?.rows || 10))
      const itemsCount = Math.max(1, Number(sortCounts?.items || 10))
      return {
        type: 'json_schema',
        json_schema: {
          name: 'sort_pairs',
          strict: true,
          schema: {
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
              explanation: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            },
            required: ['pairs'],
            additionalProperties: false,
          }
        }
      } as const
    }
    return {
      type: 'json_schema',
      json_schema: {
        name: 'answer_schema',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            letters: {
              type: 'array',
              items: { type: 'string', enum: lettersEnum },
              minItems,
              maxItems,
            },
            explanation: {
              anyOf: [ { type: 'string' }, { type: 'null' } ]
            }
          },
          // Only require letters; explanation is optional
          required: ['letters'],
          additionalProperties: false,
        }
      }
    } as const
  })()

  const requestBody = {
    model,
    messages: [{ role: 'user', content: input }],
    temperature: 0.2,
    max_tokens: 1024,
    response_format,
  }

  let response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  })
  if (!response.ok) {
    // Try graceful fallback to JSON mode when json_schema strict is unsupported
    const errorText = await response.text()
    try {
      const err = JSON.parse(errorText)
      const msg: string = String(err?.message || '')
      const code: string = String(err?.code || '')
      const unsupportedSchema = msg.includes("json_schema") || msg.includes("strict=True") || code === 'wrong_api_format'
      if (unsupportedSchema) {
        const jsonModeBody = {
          model,
          messages: [{ role: 'user', content: input }],
          temperature: 0.2,
          max_tokens: 1024,
          response_format: { type: 'json_object' as const },
        }
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(jsonModeBody),
        })
        if (!response.ok) {
          const second = await response.text()
          throw new Error(`Cerebras API ${response.status}: ${second}`)
        }
      } else {
        throw new Error(`Cerebras API ${response.status}: ${errorText}`)
      }
    } catch (e) {
      // If errorText wasn't JSON or other failure, throw original
      if (!(e instanceof Error)) throw new Error(`Cerebras API ${response.status}: ${errorText}`)
      // fallthrough if we already retried and succeeded
    }
  }
  const data = await response.json()
  const text = data?.choices?.[0]?.message?.content ?? ''
  const converted = {
    candidates: [
      {
        content: {
          parts: [{ text }],
        },
      },
    ],
  }
  return converted
}
