import { useEffect, useState } from 'react'
import type { Settings, Theme } from '../shared/types'
import { applyTheme } from '../shared/theme'

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
  theme: 'light',
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [providerModels, setProviderModels] = useState<string[]>(['gemini-2.5-flash'])
  const [testGemini, setTestGemini] = useState<'idle' | 'pending' | 'connected' | 'disconnected' | 'missing'>('idle')
  const [testCerebras, setTestCerebras] = useState<'idle' | 'pending' | 'connected' | 'disconnected' | 'missing'>('idle')

  useEffect(() => {
    chrome.storage.sync.get('settings', (data) => {
      const loaded: Settings = { ...DEFAULTS, ...(data.settings || {}) }
      applyTheme((loaded.theme as Theme) || 'light')
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
      const models = prov === 'cerebras' ? cerebrasModels : ['gemini-2.5-flash']
      // If a previously saved model is no longer available, set a sensible default
      if (prov === 'cerebras' && !models.includes(loaded.model)) {
        loaded.model = 'llama-4-scout-17b-16e-instruct'
      } else if (prov === 'gemini' && loaded.model !== 'gemini-2.5-flash') {
        loaded.model = 'gemini-2.5-flash'
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

  const testConnections = async () => {
    // Reset statuses
    setTestGemini('pending')
    setTestCerebras('pending')

    // Gemini test
    const gKey = settings.geminiApiKey || ''
    if (!gKey) {
      setTestGemini('missing')
    } else {
      chrome.runtime.sendMessage(
        { action: 'testProvider', provider: 'gemini', apiKey: gKey, model: 'gemini-2.5-flash' },
        (res) => {
          if (chrome.runtime.lastError || !res?.success) setTestGemini('disconnected'); else setTestGemini('connected')
        }
      )
    }

    // Cerebras test
    const cKey = settings.cerebrasApiKey || ''
    if (!cKey) {
      setTestCerebras('missing')
    } else {
      chrome.runtime.sendMessage(
        { action: 'testProvider', provider: 'cerebras', apiKey: cKey, model: 'qwen-3-235b-a22b-instruct-2507' },
        (res) => {
          if (chrome.runtime.lastError || !res?.success) setTestCerebras('disconnected'); else setTestCerebras('connected')
        }
      )
    }
  }

  // Apply theme when changed locally
  useEffect(() => {
    applyTheme((settings.theme as Theme) || 'light')
  }, [settings.theme])

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
      : ['gemini-2.5-flash'])
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto text-[var(--foreground)] bg-[var(--background)]">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Apex Assist Settings</h2>
        <p className="text-sm text-gray-500">Configure provider, keys, and behavior</p>
      </div>

      {/* Provider selection */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm p-4 space-y-3">
        <div className="text-sm font-medium text-gray-900">Provider</div>
        <div className="flex flex-wrap gap-2">
          {(['gemini','cerebras','hybrid'] as const).map((p) => (
            <label key={p} className={`text-sm inline-flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer select-none ${settings.provider === p ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
              <input type="radio" className="sr-only" name="provider" checked={settings.provider === p} onChange={() => onProviderChange(p)} />
              <span className="capitalize">{p}</span>
            </label>
          ))}
        </div>

        {/* Theme selection */}
        <div className="grid grid-cols-2 gap-3 items-center mt-2">
          <label className="text-sm text-gray-700">Theme</label>
          <div className="flex gap-2">
            {(['light','dark'] as Theme[]).map((t) => (
              <label key={t} className={`text-sm inline-flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer select-none ${settings.theme === t ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                <input type="radio" className="sr-only" name="theme" checked={(settings.theme || 'light') === t} onChange={() => setSettings(s => ({ ...s, theme: t }))} />
                <span className="capitalize">{t}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 items-center mt-2">
          <label className="text-sm text-gray-700">Gemini API Key</label>
          <input className="border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500" type="password" value={settings.geminiApiKey || ''} onChange={(e) => setSettings(s => ({ ...s, geminiApiKey: e.target.value }))} />

          <label className="text-sm text-gray-700">Cerebras API Key</label>
          <input className="border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500" type="password" value={settings.cerebrasApiKey || ''} onChange={(e) => setSettings(s => ({ ...s, cerebrasApiKey: e.target.value }))} />

          <label className="text-sm text-gray-700">Model</label>
          <select className="border rounded px-2 py-1 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" disabled={settings.provider === 'hybrid'} value={settings.model} onChange={(e) => setSettings(s => ({ ...s, model: e.target.value }))}>
            {providerModels.map((m) => (
              <option key={m} value={m}>{m === 'gemini-2.5-flash' ? 'Gemini 2.5 Flash' : m}</option>
            ))}
          </select>
          {settings.provider === 'hybrid' && (
            <div className="col-span-2 text-xs text-gray-600">
              Hybrid ignores manual model selection. Routing:
              <ul className="list-disc ml-5">
                <li>With images: Gemini 2.5 Flash</li>
                <li>Text-only: Cerebras Qwen-3-235B Instruct (2507)</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Behavior */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm p-4 grid grid-cols-2 gap-3 items-center">
        <div className="text-sm font-medium text-gray-900 col-span-2">Behavior</div>
        <label className="text-sm text-gray-700">Delay (sec)</label>
        <input className="border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500" type="number" min={1} max={30} value={settings.delay} onChange={(e) => setSettings(s => ({ ...s, delay: Number(e.target.value) }))} />

        <label className="text-sm text-gray-700">Sabotage</label>
        <input className="h-4 w-4" type="checkbox" checked={settings.sabotage} onChange={(e) => setSettings(s => ({ ...s, sabotage: e.target.checked }))} />

        <label className="text-sm text-gray-700">Incorrect Count</label>
        <input className="border rounded px-2 py-1 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" type="number" min={0} max={5} disabled={!settings.sabotage} value={settings.incorrectCount} onChange={(e) => setSettings(s => ({ ...s, incorrectCount: Number(e.target.value) }))} />

        <label className="text-sm text-gray-700">Attempts</label>
        <input className="border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500" type="number" min={1} max={10} value={settings.attempts} onChange={(e) => setSettings(s => ({ ...s, attempts: Number(e.target.value) }))} />

        <label className="text-sm text-gray-700">Process Images</label>
        <div className="flex items-center gap-2">
          <input className="h-4 w-4" type="checkbox" checked={settings.processImages} onChange={(e) => setSettings(s => ({ ...s, processImages: e.target.checked }))} />
          {settings.provider === 'cerebras' && settings.processImages && (
            <span className="text-xs text-amber-600">Cerebras ignores images; image questions sent as text-only.</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button className="px-3 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm hover:opacity-95" onClick={save}>Save</button>
        <button className="px-3 py-2 rounded-lg bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:opacity-95" onClick={testConnections}>Test Connections</button>
      </div>

      {/* Diagnostics */}
      <div className="text-sm grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm p-3 flex items-center justify-between">
          <span className="text-gray-700">Gemini API</span>
          <span className={`inline-flex items-center gap-2`}>
            <span>{testGemini === 'idle' ? '-' : testGemini === 'pending' ? 'Checking…' : testGemini === 'connected' ? 'Connected' : testGemini === 'missing' ? 'Missing key' : 'Disconnected'}</span>
            <span className={`inline-block h-2 w-2 rounded-full ${testGemini === 'connected' ? 'bg-green-500' : testGemini === 'pending' ? 'bg-yellow-400' : testGemini === 'missing' ? 'bg-gray-400' : 'bg-red-500'}`}></span>
          </span>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm p-3 flex items-center justify-between">
          <span className="text-gray-700">Cerebras API</span>
          <span className={`inline-flex items-center gap-2`}>
            <span>{testCerebras === 'idle' ? '-' : testCerebras === 'pending' ? 'Checking…' : testCerebras === 'connected' ? 'Connected' : testCerebras === 'missing' ? 'Missing key' : 'Disconnected'}</span>
            <span className={`inline-block h-2 w-2 rounded-full ${testCerebras === 'connected' ? 'bg-green-500' : testCerebras === 'pending' ? 'bg-yellow-400' : testCerebras === 'missing' ? 'bg-gray-400' : 'bg-red-500'}`}></span>
          </span>
        </div>
      </div>
    </div>
  )
}
