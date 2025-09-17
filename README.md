# Apex Assist

A browser extension that helps you move through Apex Learning quizzes more quickly by reading the question and choices on the page, consulting an AI provider, and selecting the suggested answer(s). Use responsibly.

Important: This project is for educational and assistive use. You are responsible for complying with your school’s policies and the website’s terms of service.

## What It Does

- Reads the current question and options on Apex pages.
- If the question contains inline images, captures a screenshot to give the AI visual context.
- Asks an AI provider for a structured answer (letters only) and selects it on the page.
- Clicks submit/next, then repeats with a configurable delay and retry logic.

## Smart Provider Routing (Hybrid)

- With images detected: Gemini `gemini-2.5-flash`.
- Text‑only questions: Cerebras `qwen-3-235b-a22b-instruct-2507`.
- You can also lock a single provider in Options.

## Quick Start

1) Build the extension
- Requirements: Node 18+ and a Chromium‑based browser
- Commands:
```
cd apex-assist-ext
npm install
npm run build
```

2) Load in Chrome
- Open `chrome://extensions`
- Enable “Developer mode”
- Click “Load unpacked” and select `apex-assist-ext/dist`

## Setup & Use

Options page:
- Enter your API keys (Gemini and/or Cerebras) and click “Test Connections”.
- Choose a provider or Hybrid.
- Adjust delay, attempts, and image processing. Pick Light/Dark theme.

Using the popup:
- Go to an Apex quiz page, open the popup, and press Start.
- Toggle with `Ctrl+Shift+A`. Press Stop anytime.

## Privacy

- When enabled, question text and (if detected) a screenshot are sent to the selected AI provider.
- Avoid use on pages with sensitive information. API keys are stored in Chrome’s `storage.sync` for your profile.

## License

MIT License — see `LICENSE` for details.
Copyright (c) 2025 Bzzimmy
