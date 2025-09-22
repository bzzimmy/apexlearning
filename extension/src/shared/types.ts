export type Provider = 'gemini' | 'cerebras' | 'openrouter' | 'hybrid';

export type Theme = 'light' | 'dark'

export interface Settings {
  provider: Provider;
  geminiApiKey?: string;
  cerebrasApiKey?: string;
  openrouterApiKey?: string;
  model: string;
  delay: number;
  sabotage: boolean;
  incorrectCount: number;
  attempts: number;
  processImages: boolean;
  theme?: Theme;
}

export interface AIResponse {
  letters: string[];
  explanation?: string;
}

// Sort question provider response shape
export interface SortAIResponse {
  pairs: Array<{ row: number; item: number }>; // 1-based indices
  explanation?: string | null;
}

export interface InlineImage {
  mimeType: string;
  data: string; // base64 without prefix
}

export type ContentMessage =
  | { action: 'startAutomation' }
  | { action: 'stopAutomation' }
  | { action: 'toggleAutomation' }
  | { action: 'getStatus' };

export type BackgroundMessage =
  | { action: 'getSettings' }
  | {
      action: 'callAIProvider';
      input: string;
      images?: InlineImage[];
      provider: string;
      apiKey: string;
      model: string;
      allowedLetters?: string[];
      isMultipleChoice?: boolean;
      // When present, providers will use a different response schema
      responseMode?: 'letters' | 'sort';
      sortCounts?: { rows: number; items: number };
      expectedCount?: number; // exact number of answers required (optional)
    }
  | { action: 'captureVisibleTab' }
  | {
      action: 'testProvider';
      provider: string;
      apiKey: string;
      model: string;
    };

// Legacy alias retained for convenience (not required)
export type TestProviderMessage = {
  action: 'testProvider';
  provider: string;
  apiKey: string;
  model: string;
};
