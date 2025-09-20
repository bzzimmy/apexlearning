import { useEffect, useState } from 'react'
import type { Settings, Theme } from '../shared/types'
import { applyTheme } from '../shared/theme'
import { Boxes, Palette, Timer, AlertTriangle, Hash, Repeat, Image as ImageIcon, SatelliteDish, KeySquare, HelpCircle, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [showCerebrasKey, setShowCerebrasKey] = useState(false)

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
      if (prov === 'cerebras' && !models.includes(loaded.model)) {
        loaded.model = 'llama-4-scout-17b-16e-instruct'
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

  const save = () => {
    chrome.storage.sync.set({ settings }, () => {
      toast.success('Settings saved')
    })
  }

  const testConnections = async () => {
    setTestGemini('pending')
    setTestCerebras('pending')

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
  }

  const StatusBadge = ({ state }: { state: typeof testGemini }) => {
    const color = state === 'connected' ? 'text-green-600' : state === 'pending' ? 'text-amber-600' : state === 'missing' ? 'text-gray-500' : 'text-rose-600'
    const label = state === 'connected' ? 'Connected' : state === 'pending' ? 'Checking…' : state === 'missing' ? 'Missing key' : state === 'idle' ? '-' : 'Disconnected'
    return <span className={`text-xs ${color}`}>{label}</span>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div className="space-y-1">
                    <Label className="inline-flex items-center gap-1.5">
                      <SatelliteDish size={14} /> Provider
                    </Label>
                    <Select value={settings.provider} onValueChange={(v: Settings['provider']) => onProviderChange(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gemini">Gemini</SelectItem>
                        <SelectItem value="cerebras">Cerebras</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
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

                  <div className="space-y-1">
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

                  <div className="space-y-1">
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
                      Manual model selection is ignored. Routing:
                      <ul className="list-disc ml-5 mt-2">
                        <li>With images: Gemini 2.5 Flash</li>
                        <li>Text-only: Cerebras Qwen-3-235B Instruct (2507)</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <Separator />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div className="flex items-center justify-between rounded-lg border bg-card p-3">
                    <span className="text-sm text-muted-foreground inline-flex items-center gap-1.5"><SatelliteDish size={14} /> Gemini API</span>
                    <StatusBadge state={testGemini} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border bg-card p-3">
                    <span className="text-sm text-muted-foreground inline-flex items-center gap-1.5"><SatelliteDish size={14} /> Cerebras API</span>
                    <StatusBadge state={testCerebras} />
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="secondary" onClick={testConnections}>Test Connections</Button>
                  <Button onClick={save}>Save</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="behavior" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>Behavior</CardTitle>
                <CardDescription>Timing, retries, and image handling</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div className="space-y-1">
                  <Label className="inline-flex items-center gap-1.5"><Timer size={14} /> Delay (sec)</Label>
                  <Input type="number" min={1} max={30} value={settings.delay} onChange={(e) => setSettings(s => ({ ...s, delay: Number(e.target.value) }))} />
                </div>

                <div className="space-y-1">
                  <Label className="inline-flex items-center gap-1.5"><Repeat size={14} /> Attempts</Label>
                  <Input type="number" min={1} max={10} value={settings.attempts} onChange={(e) => setSettings(s => ({ ...s, attempts: Number(e.target.value) }))} />
                </div>

                <div className="flex items-center justify-between rounded-lg border bg-card p-3 col-span-1 sm:col-span-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><AlertTriangle size={14} /> Sabotage</div>
                  <Switch checked={settings.sabotage} onCheckedChange={(v) => setSettings(s => ({ ...s, sabotage: !!v }))} />
                </div>

                <div className="space-y-1">
                  <Label className="inline-flex items-center gap-1.5"><Hash size={14} /> Incorrect Count</Label>
                  <Input type="number" min={0} max={5} disabled={!settings.sabotage} value={settings.incorrectCount} onChange={(e) => setSettings(s => ({ ...s, incorrectCount: Number(e.target.value) }))} />
                </div>

                <div className="flex items-center justify-between rounded-lg border bg-card p-3 col-span-1 sm:col-span-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><ImageIcon size={14} /> Process Images</div>
                  <Switch checked={settings.processImages} onCheckedChange={(v) => setSettings(s => ({ ...s, processImages: !!v }))} />
                </div>

                {settings.provider === 'cerebras' && settings.processImages && (
                  <Alert className="col-span-1 sm:col-span-2">
                    <AlertTitle>Image processing ignored</AlertTitle>
                    <AlertDescription>Cerebras routes image questions as text-only.</AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2 justify-end col-span-1 sm:col-span-2">
                  <Button variant="secondary" onClick={testConnections}>Test Connections</Button>
                  <Button onClick={save}>Save</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Theme and basic styling</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div className="space-y-1">
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

                <div className="flex items-center justify-end gap-2 col-span-1 sm:col-span-2">
                  <Button variant="secondary" onClick={() => applyTheme((settings.theme as Theme) || 'light')}>Preview</Button>
                  <Button onClick={save}>Save</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <p className="text-[10px] text-muted-foreground text-center">© {new Date().getFullYear()} Apex Assist</p>
      </div>
    </TooltipProvider>
  )
}
