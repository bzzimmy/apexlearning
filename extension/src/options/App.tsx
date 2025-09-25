import { useEffect, useState } from 'react'
import type { Settings, Theme } from '../shared/types'
import { applyTheme } from '../shared/theme'
import { Boxes, Palette, Timer, AlertTriangle, Hash, Repeat, Image as ImageIcon, SatelliteDish, KeySquare, HelpCircle, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

const DEFAULTS: Settings = {
  provider: 'gemini',
  geminiApiKey: '',
  cerebrasApiKey: '',
  openrouterApiKey: '',
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
  const [testOpenRouter, setTestOpenRouter] = useState<'idle' | 'pending' | 'connected' | 'disconnected' | 'missing'>('idle')
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [showCerebrasKey, setShowCerebrasKey] = useState(false)
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false)

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
      const openrouterModels = [
        'google/gemini-2.5-pro',
        'openai/gpt-5',
        'openai/gpt-5-mini',
        'anthropic/claude-sonnet-4',
        'x-ai/grok-4-fast:free',
        'mistralai/mistral-small-3.2-24b-instruct:free',
        'meta-llama/llama-4-maverick:free',
        'meta-llama/llama-4-scout:free',
      ]
      const models = prov === 'cerebras' ? cerebrasModels : prov === 'openrouter' ? openrouterModels : ['gemini-2.5-flash']
      if (prov === 'cerebras' && !models.includes(loaded.model)) {
        loaded.model = 'llama-4-scout-17b-16e-instruct'
      } else if (prov === 'openrouter' && !models.includes(loaded.model)) {
        loaded.model = 'x-ai/grok-4-fast:free'
      } else if (prov === 'gemini' && loaded.model !== 'gemini-2.5-flash') {
        loaded.model = 'gemini-2.5-flash'
      }
      setSettings(loaded)
      setProviderModels(models)
    })
  }, [])

  // Apply theme when changed locally
  useEffect(() => {
    applyTheme((settings.theme as Theme) || 'light')
  }, [settings.theme])

  const onProviderChange = (prov: Settings['provider']) => {
    setSettings((s) => ({ ...s, provider: prov, model: prov === 'cerebras' ? 'llama-4-scout-17b-16e-instruct' : prov === 'openrouter' ? 'x-ai/grok-4-fast:free' : 'gemini-2.5-flash' }))
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
      : prov === 'openrouter' ? [
          'google/gemini-2.5-pro',
          'openai/gpt-5',
          'openai/gpt-5-mini',
          'anthropic/claude-sonnet-4',
          'x-ai/grok-4-fast:free',
          'mistralai/mistral-small-3.2-24b-instruct:free',
          'meta-llama/llama-4-maverick:free',
          'meta-llama/llama-4-scout:free',
        ] : ['gemini-2.5-flash'])
  }

  const save = () => {
    chrome.storage.sync.set({ settings }, () => {
      toast.success('Settings saved')
    })
  }

  const testConnections = async () => {
    setTestGemini('pending')
    setTestCerebras('pending')
    setTestOpenRouter('pending')

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

    const oKey = settings.openrouterApiKey || ''
    if (!oKey) {
      setTestOpenRouter('missing')
    } else {
      chrome.runtime.sendMessage(
        { action: 'testProvider', provider: 'openrouter', apiKey: oKey, model: 'x-ai/grok-4-fast:free' },
        (res) => {
          if (chrome.runtime.lastError || !res?.success) setTestOpenRouter('disconnected'); else setTestOpenRouter('connected')
        }
      )
    }
  }

  const StatusPill = ({ state, label }: { state: typeof testGemini; label: string }) => {
    const color = state === 'connected' ? 'bg-green-500' : state === 'pending' ? 'bg-amber-500' : state === 'missing' ? 'bg-gray-400' : state === 'idle' ? 'bg-gray-300' : 'bg-rose-500'
    const text = state === 'connected' ? 'Connected' : state === 'pending' ? 'Checking…' : state === 'missing' ? 'Missing key' : state === 'idle' ? '-' : 'Disconnected'
    return (
      <div className="inline-flex items-center gap-2 text-xs max-w-full">
        <span className="text-muted-foreground shrink-0">{label}</span>
        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 whitespace-nowrap">
          <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
          <span>{text}</span>
        </span>
      </div>
    )
  }


  return (
    <TooltipProvider disableHoverableContent>
      <div className="p-6 space-y-6 max-w-2xl mx-auto bg-background text-foreground">
        <div className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Apex Assist Settings</h2>
          <p className="text-sm text-muted-foreground">Configure provider, keys, behavior, and appearance</p>
        </div>

        <Tabs defaultValue="provider" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="provider">Provider</TabsTrigger>
            <TabsTrigger value="behavior">Behavior</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
          </TabsList>

          <TabsContent value="provider" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>Provider</CardTitle>
                <CardDescription>Select provider, keys, and model</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  {/* Provider */}
                  <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] items-center gap-2">
                    <Label className="inline-flex items-center gap-1.5"><SatelliteDish size={14} /> Provider</Label>
                    <Select value={settings.provider} onValueChange={(v: Settings['provider']) => onProviderChange(v)}>
                      <SelectTrigger className="flex items-center gap-2">
                        <SelectValue placeholder="Select a provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gemini">
                          <span className="inline-flex items-center gap-2">
                            <img src={chrome.runtime.getURL('images/gemini-color.png')} className="h-4 w-4" />
                            Gemini
                          </span>
                        </SelectItem>
                        <SelectItem value="cerebras">
                          <span className="inline-flex items-center gap-2">
                            <img src={chrome.runtime.getURL('images/cerebras-color.png')} className="h-4 w-4" />
                            Cerebras
                          </span>
                        </SelectItem>
                        <SelectItem value="openrouter">
                          <span className="inline-flex items-center gap-2">
                            <img src={chrome.runtime.getURL('images/openrouter.png')} className="h-4 w-4 openrouter-icon" />
                            OpenRouter
                          </span>
                        </SelectItem>
                        <SelectItem value="hybrid">
                          <span className="inline-flex items-center gap-2">
                            <img src={chrome.runtime.getURL('images/hybrid.png')} className="h-4 w-4" />
                            Hybrid
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Gemini key */}
                  <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] items-center gap-2">
                    <Label className="inline-flex items-center gap-1.5">
                      <KeySquare size={14} /> Gemini API Key
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle size={14} className="text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>Required for Gemini provider or Hybrid (with images).</TooltipContent>
                      </Tooltip>
                    </Label>
                    <div className="relative">
                      <Input
                        type={showGeminiKey ? 'text' : 'password'}
                        value={settings.geminiApiKey || ''}
                        onChange={(e) => setSettings(s => ({ ...s, geminiApiKey: e.target.value }))}
                      />
                      <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2" onClick={() => setShowGeminiKey(v => !v)} aria-label={showGeminiKey ? 'Hide Gemini API key' : 'Show Gemini API key'}>
                        {showGeminiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </Button>
                    </div>
                  </div>

                  {/* Cerebras key */}
                  <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] items-center gap-2">
                    <Label className="inline-flex items-center gap-1.5">
                      <KeySquare size={14} /> Cerebras API Key
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle size={14} className="text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>Required for Cerebras provider or Hybrid (text-only).</TooltipContent>
                      </Tooltip>
                    </Label>
                    <div className="relative">
                      <Input
                        type={showCerebrasKey ? 'text' : 'password'}
                        value={settings.cerebrasApiKey || ''}
                        onChange={(e) => setSettings(s => ({ ...s, cerebrasApiKey: e.target.value }))}
                      />
                      <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2" onClick={() => setShowCerebrasKey(v => !v)} aria-label={showCerebrasKey ? 'Hide Cerebras API key' : 'Show Cerebras API key'}>
                        {showCerebrasKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </Button>
                    </div>
                  </div>

                  {/* OpenRouter key */}
                  <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] items-center gap-2">
                    <Label className="inline-flex items-center gap-1.5">
                      <KeySquare size={14} /> OpenRouter API Key
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle size={14} className="text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>Required for OpenRouter provider.</TooltipContent>
                      </Tooltip>
                    </Label>
                    <div className="relative">
                      <Input
                        type={showOpenRouterKey ? 'text' : 'password'}
                        value={settings.openrouterApiKey || ''}
                        onChange={(e) => setSettings(s => ({ ...s, openrouterApiKey: e.target.value }))}
                      />
                      <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2" onClick={() => setShowOpenRouterKey(v => !v)} aria-label={showOpenRouterKey ? 'Hide OpenRouter API key' : 'Show OpenRouter API key'}>
                        {showOpenRouterKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </Button>
                    </div>
                  </div>

                  {/* Model */}
                  <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] items-center gap-2">
                    <Label className="inline-flex items-center gap-1.5"><Boxes size={14} /> Model</Label>
                    <Select value={settings.model} onValueChange={(v) => setSettings(s => ({ ...s, model: v }))} disabled={settings.provider === 'hybrid'}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        {providerModels.map((m) => (
                          <SelectItem key={m} value={m}>{m === 'gemini-2.5-flash' ? 'Gemini 2.5 Flash' : m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {settings.provider === 'hybrid' && (
                  <Alert>
                    <AlertTitle>Hybrid routing</AlertTitle>
                    <AlertDescription>
                      Routes your request through the best AI model for the question you’re on.
                    </AlertDescription>
                  </Alert>
                )}

                {settings.provider === 'cerebras' && (
                  <Alert>
                    <AlertTitle>Cerebras image handling</AlertTitle>
                    <AlertDescription>
                      This provider doesn’t process images; we’ll send image questions as text.
                    </AlertDescription>
                  </Alert>
                )}

                <Separator />
              </CardContent>
              <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-3 w-full sm:flex-1">
                  <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 flex-1 min-w-[220px]">
                    <span className="text-sm text-muted-foreground inline-flex items-center gap-1.5"><SatelliteDish size={14} /> Gemini API</span>
                    <StatusPill state={testGemini} label="Status" />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 flex-1 min-w-[220px]">
                    <span className="text-sm text-muted-foreground inline-flex items-center gap-1.5"><SatelliteDish size={14} /> Cerebras API</span>
                    <StatusPill state={testCerebras} label="Status" />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 flex-1 min-w-[220px]">
                    <span className="text-sm text-muted-foreground inline-flex items-center gap-1.5"><SatelliteDish size={14} /> OpenRouter API</span>
                    <StatusPill state={testOpenRouter} label="Status" />
                  </div>
                </div>
                <div className="flex gap-2 sm:ml-auto">
                  <Button variant="secondary" onClick={testConnections}>Test Connections</Button>
                  <Button onClick={save}>Save</Button>
                </div>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="behavior" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>Behavior</CardTitle>
                <CardDescription>Timing, retries, and image handling</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] items-center gap-2">
                    <Label className="inline-flex items-center gap-1.5"><Timer size={14} /> Delay (sec)</Label>
                    <Input type="number" min={1} max={30} value={settings.delay} onChange={(e) => setSettings(s => ({ ...s, delay: Number(e.target.value) }))} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] items-center gap-2">
                    <Label className="inline-flex items-center gap-1.5"><Repeat size={14} /> Attempts</Label>
                    <Input type="number" min={1} max={10} value={settings.attempts} onChange={(e) => setSettings(s => ({ ...s, attempts: Number(e.target.value) }))} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] items-center gap-2">
                    <Label className="inline-flex items-center gap-1.5"><AlertTriangle size={14} /> Sabotage</Label>
                    <div className="flex justify-end sm:justify-start"><Switch checked={settings.sabotage} onCheckedChange={(v) => setSettings(s => ({ ...s, sabotage: !!v }))} /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] items-center gap-2">
                    <Label className="inline-flex items-center gap-1.5"><Hash size={14} /> Incorrect Count</Label>
                    <Input type="number" min={0} max={5} disabled={!settings.sabotage} value={settings.incorrectCount} onChange={(e) => setSettings(s => ({ ...s, incorrectCount: Number(e.target.value) }))} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] items-center gap-2">
                    <Label className="inline-flex items-center gap-1.5"><ImageIcon size={14} /> Process Images</Label>
                    <div className="flex justify-end sm:justify-start"><Switch checked={settings.processImages} onCheckedChange={(v) => setSettings(s => ({ ...s, processImages: !!v }))} /></div>
                  </div>

                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button variant="secondary" onClick={testConnections}>Test Connections</Button>
                <Button onClick={save}>Save</Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Theme and basic styling</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] items-center gap-2">
                  <Label className="inline-flex items-center gap-1.5"><Palette size={14} /> Theme</Label>
                  <Select value={settings.theme || 'light'} onValueChange={(v: Theme) => setSettings(s => ({ ...s, theme: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => applyTheme((settings.theme as Theme) || 'light')}>Preview</Button>
                <Button onClick={save}>Save</Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>

        <p className="text-[10px] text-muted-foreground text-center">© {new Date().getFullYear()} Apex Assist</p>
      </div>
    </TooltipProvider>
  )
}
