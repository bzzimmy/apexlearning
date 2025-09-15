import { useEffect, useState } from 'react'

type ApiState = 'pending' | 'connected' | 'disconnected'

export default function App() {
  const [status, setStatus] = useState<'running' | 'ready' | 'error'>('ready')
  const [api, setApi] = useState<ApiState>('pending')
  const [modelName, setModelName] = useState<string>('Loading...')
  const [quizName, setQuizName] = useState<string>('Not detected')
  const [quizProgress, setQuizProgress] = useState<string>('-/-')
  const [isApex, setIsApex] = useState<boolean>(false)

  useEffect(() => {
    const check = () => {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (!tab) return
        const onApex = Boolean(tab.url && (tab.url.includes('apexvs.com') || tab.url.includes('course.apexlearning.com')))
        setIsApex(onApex)
        if (!tab.id) return
        chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, (response) => {
          if (chrome.runtime.lastError) {
            setStatus('error')
            return
          }
          setStatus(response?.running ? 'running' : 'ready')
          if (response?.quizInfo) {
            setQuizName(response.quizInfo.name || 'Unknown')
            setQuizProgress(response.quizInfo.completed ? 'Completed' : `${response.quizInfo.currentQuestion}/${response.quizInfo.totalQuestions}`)
          }
        })
      })
    }
    check()
    const iv = setInterval(check, 2000)
    return () => clearInterval(iv)
  }, [])

  const start = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab?.id) return
      chrome.tabs.sendMessage(tab.id, { action: 'startAutomation' })
      setStatus('running')
    })
  }

  const stop = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab?.id) return
      chrome.tabs.sendMessage(tab.id, { action: 'stopAutomation' })
      setStatus('ready')
    })
  }

  // Load model info and test API
  useEffect(() => {
    chrome.storage.sync.get('settings', (result) => {
      const settings = result.settings || { provider: 'gemini', model: 'gemini-2.5-flash' }
      const provider = settings.provider || 'gemini'
      const model = settings.model || 'gemini-2.5-flash'
      if (provider === 'gemini') {
        setModelName(model === 'gemini-2.0-flash' ? 'Gemini 2.0 Flash' : 'Gemini 2.5 Flash')
      } else if (provider === 'cerebras') {
        const friendly: Record<string, string> = {
          'llama-4-scout-17b-16e-instruct': 'Llama 4 Scout 17B (Cerebras)',
          'llama3.1-8b': 'Llama 3.1 8B (Cerebras)',
          'llama-3.3-70b': 'Llama 3.3 70B (Cerebras)',
          'qwen-3-32b': 'Qwen 3 32B (Cerebras)',
          'llama-4-maverick-17b-128e-instruct': 'Llama 4 Maverick 17B (Cerebras)',
          'qwen-3-235b-a22b-instruct-2507': 'Qwen 3 235B Instruct (Cerebras)',
          'qwen-3-235b-a22b-thinking-2507': 'Qwen 3 235B Thinking (Cerebras)',
          'qwen-3-coder-480b': 'Qwen 3 Coder 480B (Cerebras)',
        }
        setModelName(friendly[model] || `${model} (Cerebras)`)
      } else {
        setModelName(`${model} (${provider})`)
      }

      const apiKey = provider === 'cerebras' ? settings.cerebrasApiKey : settings.geminiApiKey
      if (!apiKey) { setApi('disconnected'); return }
      chrome.runtime.sendMessage({ action: 'testProvider', provider, apiKey, model }, (response) => {
        if (chrome.runtime.lastError || !response?.success) setApi('disconnected'); else setApi('connected')
      })
    })
  }, [])

  return (
    <div className="w-[340px] p-4 space-y-3">
      <div>
        <h3 className="text-lg font-semibold">Apex Assist</h3>
        <p className="text-sm text-gray-500">AI-powered Apex Learning automation</p>
      </div>

      <div className="rounded border p-2 text-sm flex flex-col gap-1">
        <div className="flex justify-between"><span className="text-gray-600">Model:</span><span>{modelName}</span></div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">API:</span>
          <span className="flex items-center gap-2">
            <span>{api === 'pending' ? 'Checking...' : api === 'connected' ? 'Connected' : 'Disconnected'}</span>
            <span className={`inline-block h-2 w-2 rounded-full ${api === 'connected' ? 'bg-green-500' : api === 'pending' ? 'bg-yellow-400' : 'bg-red-500'}`}></span>
          </span>
        </div>
      </div>

      <div className="rounded border p-2 text-sm flex flex-col gap-1">
        <div className="flex justify-between"><span className="text-gray-600">Quiz:</span><span className="truncate max-w-[200px] text-right">{quizName}</span></div>
        <div className="flex justify-between"><span className="text-gray-600">Progress:</span><span>{quizProgress}</span></div>
      </div>

      <div className="flex gap-2">
        <button
          className="px-3 py-2 rounded bg-indigo-600 text-white disabled:opacity-50"
          onClick={start}
          disabled={status === 'running' || !isApex || quizProgress === 'Completed'}
        >
          Start
        </button>
        <button
          className="px-3 py-2 rounded bg-gray-200 text-gray-900 disabled:opacity-50"
          onClick={stop}
          disabled={status !== 'running'}
        >
          Stop
        </button>
      </div>

      <p className="text-sm">Status: <strong className="uppercase">{!isApex ? 'Not on Apex site' : status}</strong></p>
      <div className="flex justify-between">
        <a className="text-indigo-600 hover:underline text-sm" href="../options/index.html" target="_blank" rel="noreferrer">Options</a>
        <a className="text-indigo-600 hover:underline text-sm" href="../about/index.html" target="_blank" rel="noreferrer">About</a>
      </div>
    </div>
  )
}
