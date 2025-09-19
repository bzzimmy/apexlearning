import type { InlineImage } from '../shared/types'
import { callGemini } from './gemini'
import { callCerebras } from './cerebras'

export type ProviderId = 'gemini' | 'cerebras'

export interface ProviderCallArgs {
  provider: ProviderId
  input: string
  images: InlineImage[]
  apiKey: string
  model: string
  allowedLetters?: string[]
  isMultipleChoice?: boolean
  responseMode?: 'letters' | 'sort'
  sortCounts?: { rows: number; items: number }
}

export async function callProvider(args: ProviderCallArgs): Promise<any> {
  const { provider } = args
  if (provider === 'gemini') return callGemini(args)
  if (provider === 'cerebras') return callCerebras(args)
  throw new Error(`Unsupported provider: ${provider}`)
}

export async function testProvider({ provider, apiKey, model }: { provider: ProviderId; apiKey: string; model: string }): Promise<boolean> {
  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}?key=${encodeURIComponent(apiKey)}`
    const res = await fetch(url)
    return res.ok
  }
  if (provider === 'cerebras') {
    const apiUrl = 'https://api.cerebras.ai/v1/chat/completions'
    const body = {
      model,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
      temperature: 0,
    }
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    })
    return res.ok
  }
  return false
}
