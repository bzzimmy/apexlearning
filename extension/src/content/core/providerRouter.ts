import type { Settings } from '../../shared/types'

export type ProviderChoice = { provider: 'gemini' | 'cerebras' | 'openrouter'; model: string; apiKey?: string }

export function chooseProvider(settings: Settings, hasInlineMedia: boolean): ProviderChoice {
  if (settings.provider === 'hybrid') {
    if (hasInlineMedia) {
      return { provider: 'gemini', model: 'gemini-2.5-flash', apiKey: settings.geminiApiKey }
    } else {
      return { provider: 'cerebras', model: 'qwen-3-235b-a22b-instruct-2507', apiKey: settings.cerebrasApiKey }
    }
  } else if (settings.provider === 'cerebras') {
    return { provider: 'cerebras', model: settings.model, apiKey: settings.cerebrasApiKey }
  } else if (settings.provider === 'openrouter') {
    return { provider: 'openrouter', model: settings.model, apiKey: settings.openrouterApiKey }
  } else {
    return { provider: 'gemini', model: settings.model, apiKey: settings.geminiApiKey }
  }
}
