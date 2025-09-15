import { useEffect, useState } from 'react'
import type { Settings } from '../shared/types'

const DEFAULTS: Settings = {
  provider: 'gemini',
  geminiApiKey: '',
  cerebrasApiKey: '',
  model: 'gemini-2.5-flash',
  delay: 5,
  sabotage: true,
  incorrectCount: 2,
  attempts: 3,
  processImages: true,
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [providerModels, setProviderModels] = useState<string[]>(['gemini-2.5-flash', 'gemini-2.0-flash'])

  useEffect(() => {
    chrome.storage.sync.get('settings', (data) => {
      const loaded: Settings = { ...DEFAULTS, ...(data.settings || {}) }
      const prov = loaded.provider ?? DEFAULTS.provider
      const cerebrasModels = [
        'llama-4-scout-17b-16e-instruct',
        'llama3.1-8b',
        'llama-3.3-70b',
        'qwen-3-32b',
        'llama-4-maverick-17b-128e-instruct',
        'qwen-3-235b-a22b-instruct-2507',
        'qwen-3-235b-a22b-thinking-2507',
        'qwen-3-coder-480b',
      ]
      const models = prov === 'cerebras' ? cerebrasModels : ['gemini-2.5-flash', 'gemini-2.0-flash']
      // If a previously saved model is no longer available, set a sensible default
      if (prov === 'cerebras' && !models.includes(loaded.model)) {
        loaded.model = 'llama-4-scout-17b-16e-instruct'
      }
      setSettings(loaded)
      setProviderModels(models)
    })
  }, [])

  const save = () => {
    chrome.storage.sync.set({ settings }, () => {
      // eslint-disable-next-line no-alert
      alert('Settings saved')
    })
  }

  const test = async () => {
    const provider = settings.provider
    const apiKey = provider === 'cerebras' ? settings.cerebrasApiKey : settings.geminiApiKey
    const model = settings.model
    if (!apiKey) { alert(`Please enter a ${provider} API key first`); return }
    chrome.runtime.sendMessage({ action: 'testProvider', provider, apiKey, model }, (response) => {
      if (chrome.runtime.lastError || !response?.success) alert('Disconnected'); else alert('Connected')
    })
  }

  const onProviderChange = (prov: Settings['provider']) => {
    setSettings((s) => ({ ...s, provider: prov, model: prov === 'cerebras' ? 'llama-4-scout-17b-16e-instruct' : 'gemini-2.5-flash' }))
    setProviderModels(prov === 'cerebras'
      ? [
          'llama-4-scout-17b-16e-instruct',
          'llama3.1-8b',
          'llama-3.3-70b',
          'qwen-3-32b',
          'llama-4-maverick-17b-128e-instruct',
          'qwen-3-235b-a22b-instruct-2507',
          'qwen-3-235b-a22b-thinking-2507',
          'qwen-3-coder-480b',
        ]
      : ['gemini-2.5-flash', 'gemini-2.0-flash'])
  }

  return (
    <div className="p-6 space-y-6 max-w-xl">
      <h2 className="text-xl font-semibold">Apex Assist Options</h2>

      <div className="grid grid-cols-2 gap-3 items-center">
        <label className="text-sm text-gray-700">Provider</label>
        <div className="flex gap-4">
          <label className="text-sm text-gray-800 inline-flex items-center gap-1">
            <input type="radio" name="provider" checked={settings.provider === 'gemini'} onChange={() => onProviderChange('gemini')} />
            Gemini
          </label>
          <label className="text-sm text-gray-800 inline-flex items-center gap-1">
            <input type="radio" name="provider" checked={settings.provider === 'cerebras'} onChange={() => onProviderChange('cerebras')} />
            Cerebras
          </label>
          <label className="text-sm text-gray-800 inline-flex items-center gap-1">
            <input type="radio" name="provider" checked={settings.provider === 'hybrid'} onChange={() => onProviderChange('hybrid')} />
            Hybrid
          </label>
        </div>

        <label className="text-sm text-gray-700">Gemini API Key</label>
        <input className="border rounded px-2 py-1" type="password" value={settings.geminiApiKey || ''} onChange={(e) => setSettings(s => ({ ...s, geminiApiKey: e.target.value }))} />

        <label className="text-sm text-gray-700">Cerebras API Key</label>
        <input className="border rounded px-2 py-1" type="password" value={settings.cerebrasApiKey || ''} onChange={(e) => setSettings(s => ({ ...s, cerebrasApiKey: e.target.value }))} />

        <label className="text-sm text-gray-700">Model</label>
        <select className="border rounded px-2 py-1" value={settings.model} onChange={(e) => setSettings(s => ({ ...s, model: e.target.value }))}>
          {providerModels.map((m) => (
            <option key={m} value={m}>{m === 'gemini-2.5-flash' ? 'Gemini 2.5 Flash' : m === 'gemini-2.0-flash' ? 'Gemini 2.0 Flash' : m}</option>
          ))}
        </select>

        <label className="text-sm text-gray-700">Delay (sec)</label>
        <input className="border rounded px-2 py-1" type="number" min={1} max={30} value={settings.delay} onChange={(e) => setSettings(s => ({ ...s, delay: Number(e.target.value) }))} />

        <label className="text-sm text-gray-700">Sabotage</label>
        <input className="h-4 w-4" type="checkbox" checked={settings.sabotage} onChange={(e) => setSettings(s => ({ ...s, sabotage: e.target.checked }))} />

        <label className="text-sm text-gray-700">Incorrect Count</label>
        <input className="border rounded px-2 py-1 disabled:opacity-50" type="number" min={0} max={5} disabled={!settings.sabotage} value={settings.incorrectCount} onChange={(e) => setSettings(s => ({ ...s, incorrectCount: Number(e.target.value) }))} />

        <label className="text-sm text-gray-700">Attempts</label>
        <input className="border rounded px-2 py-1" type="number" min={1} max={10} value={settings.attempts} onChange={(e) => setSettings(s => ({ ...s, attempts: Number(e.target.value) }))} />

        <label className="text-sm text-gray-700">Process Images</label>
        <div className="flex items-center gap-2">
          <input className="h-4 w-4" type="checkbox" checked={settings.processImages} onChange={(e) => setSettings(s => ({ ...s, processImages: e.target.checked }))} />
          {settings.provider === 'cerebras' && settings.processImages && (
            <span className="text-xs text-amber-600">Cerebras ignores images; image questions sent as text-only.</span>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button className="px-3 py-2 rounded bg-indigo-600 text-white" onClick={save}>Save</button>
        <button className="px-3 py-2 rounded bg-gray-200" onClick={test}>Test Connection</button>
      </div>
    </div>
  )
}
