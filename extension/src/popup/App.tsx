import { useEffect, useState } from 'react'
import { Brain, Network, GraduationCap, Gauge, Play, Square, Settings as SettingsIcon, Info, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { applyTheme } from '../shared/theme'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

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
        const onApex = Boolean(
          tab.url && (
            tab.url.includes('apexvs.com') ||
            tab.url.includes('course.apexlearning.com') ||
            tab.url.includes('course.apex.app.edmentum.com')
          )
        )
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
      // Apply theme from settings (default light)
      applyTheme((settings.theme as any) || 'light')
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

      const apiKey = provider === 'cerebras' ? settings.cerebrasApiKey : provider === 'openrouter' ? settings.openrouterApiKey : settings.geminiApiKey
      if (!apiKey) { setApi('disconnected'); return }
      chrome.runtime.sendMessage({ action: 'testProvider', provider, apiKey, model }, (response) => {
        if (chrome.runtime.lastError || !response?.success) setApi('disconnected'); else setApi('connected')
      })
    })
  }, [])

  // Status badge mapping
  const { label: statusLabel, variant: statusVariant, Icon: StatusIcon } = (() => {
    if (!isApex) return { label: 'Not on Apex', variant: 'secondary' as const, Icon: Info }
    if (status === 'running') return { label: 'Running', variant: 'default' as const, Icon: Loader2 }
    if (status === 'error') return { label: 'Error', variant: 'destructive' as const, Icon: XCircle }
    return { label: 'Ready', variant: 'secondary' as const, Icon: CheckCircle2 }
  })()

  return (
    <div className="w-[320px] bg-background text-foreground">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 bg-card border-b border-border text-center">
        <h3 className="text-lg font-semibold tracking-tight">Apex Assist</h3>
        <p className="text-xs text-muted-foreground">AI-powered Apex automation</p>
      </div>

      {/* Status */}
      <div className="px-4 pt-3">
        <div className="flex justify-center">
          <Badge variant={statusVariant as any} className="inline-flex items-center gap-1.5">
            <StatusIcon size={14} className={StatusIcon === Loader2 ? 'animate-spin' : ''} />
            <span>Status: {statusLabel}</span>
          </Badge>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Model / API</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground"><Brain size={16} /> Model</div>
              <div className="font-medium text-right truncate max-w-[160px]" title={modelName}>{modelName}</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground"><Network size={16} /> API</div>
              <div className="flex items-center gap-2">
                <span className="text-sm">{api === 'pending' ? 'Checking…' : api === 'connected' ? 'Connected' : 'Disconnected'}</span>
                <span className={`inline-block h-2 w-2 rounded-full ${api === 'connected' ? 'bg-green-500' : api === 'pending' ? 'bg-amber-400' : 'bg-rose-500'}`}></span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Quiz</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground"><GraduationCap size={16} /> Name</div>
              <div className="truncate max-w-[160px] text-right" title={quizName}>{quizName}</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground"><Gauge size={16} /> Progress</div>
              <div className="font-medium">{quizProgress}</div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button className="flex-1 inline-flex items-center gap-2" onClick={start} disabled={status === 'running' || !isApex || quizProgress === 'Completed'}>
            <Play size={16} /> Start
          </Button>
          <Button variant="secondary" className="flex-1 inline-flex items-center gap-2" onClick={stop} disabled={status !== 'running'}>
            <Square size={16} /> Stop
          </Button>
        </div>

        <div className="flex items-center justify-center">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="../options/index.html" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1"><SettingsIcon size={14} /> Options</a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="../about/index.html" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1"><Info size={14} /> About</a>
            </Button>
          </div>
        </div>

        <Separator />
        <p className="text-[10px] text-muted-foreground text-center">© {new Date().getFullYear()} Apex Assist</p>
      </div>
    </div>
  )
}
