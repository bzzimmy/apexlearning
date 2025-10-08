import { useEffect } from 'react'
import { Info, Shield, Sparkles, Github } from 'lucide-react'
import { applyTheme } from '../shared/theme'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export default function App() {
  useEffect(() => {
    chrome.storage.sync.get('settings', (result) => {
      const settings = result.settings || {}
      applyTheme((settings.theme as any) || 'light')
    })
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">About Apex Assist</h1>
          <p className="text-muted-foreground">AI-powered Apex Learning automation</p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                What is Apex Assist?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                Apex Assist is a Chrome extension designed to automate quizzes and tests on Apex Learning using AI technology.
              </p>
              <p>
                The extension integrates with multiple AI providers (Gemini, Cerebras, OpenRouter) to analyze questions and automatically select answers.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                How it Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <ul className="list-disc list-inside space-y-2">
                <li>Analyzes questions and answer options on the page</li>
                <li>Optionally captures screenshots for questions with images</li>
                <li>Sends the question to your configured AI provider</li>
                <li>Automatically selects and submits the suggested answer(s)</li>
                <li>Supports single-choice, multiple-choice, and sort/match questions</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Privacy & Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <ul className="list-disc list-inside space-y-2">
                <li>API keys are stored locally in Chrome storage on your device</li>
                <li>When enabled, question text and screenshots are sent to your AI provider</li>
                <li>No data is collected or stored by this extension</li>
                <li>All processing happens client-side in your browser</li>
              </ul>
            </CardContent>
          </Card>

          <Separator />

          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Use responsibly and in accordance with your institution's policies.
            </p>
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Github className="h-3 w-3" />
                <span>© {new Date().getFullYear()} Bzzimmy</span>
              </div>
              <span>•</span>
              <span>MIT License</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
