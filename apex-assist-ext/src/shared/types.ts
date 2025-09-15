export type Provider = 'gemini' | 'cerebras' | 'hybrid';

export interface Settings {
  provider: Provider;
  geminiApiKey?: string;
  cerebrasApiKey?: string;
  model: string;
  delay: number;
  sabotage: boolean;
  incorrectCount: number;
  attempts: number;
  processImages: boolean;
}

export interface AIResponse {
  letters: string[];
  explanation?: string;
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
