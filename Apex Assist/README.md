# Apex Assist

Created by Bzzimmy
Subscribe to my YouTube: https://www.youtube.com/@bzzimmy

---

Apex Assist is a Chrome extension designed to automate quizzes and tests on Apex Learning platforms (`*.apexvs.com`, `*.course.apexlearning.com`) using the Google Gemini AI.

## Features

*   **AI-Powered Answers:** Uses Google Gemini to analyze questions and determine the most likely correct answer.
*   **Image Processing:** Can capture the screen and send images to the AI for questions involving visual elements (ensure your selected Gemini model supports image inputs).
*   **Multiple Choice Support:** Handles both single-choice and multiple-choice (select all that apply) questions.
*   **Configurable Behavior:**
    *   Set delays between answering questions.
    *   Enable a "sabotage" feature to intentionally miss a configurable number of questions for more natural results.
    *   Choose the specific Gemini model to use (e.g., `gemini-2.5-flash`, `gemini-2.0-flash`).
    *   Configure the number of retry attempts if the script fails to get an answer.
*   **Status Monitoring:** The popup shows connection status, the model being used, and quiz progress.
*   **Simple Controls:** Easily start and stop the automation from the extension popup.

## How it Works

1.  **Content Script (`scripts/content.js`):** Injected into Apex Learning pages.
    *   Extracts the question text and answer options from the page elements.
    *   Captures the visible tab as an image if `processImages` is enabled.
    *   Sends the question, options, and image (if any) to the background script.
    *   Receives the AI's answer from the background script.
    *   Selects the corresponding answer(s) on the page.
    *   Clicks the submit/next button.
    *   Implements the delay and sabotage logic.
2.  **Background Script (`scripts/background.js`):**
    *   Listens for messages from the content script and popup.
    *   Handles requests to call the Google Gemini API using the user's provided API key and selected model.
    *   Manages settings storage and retrieval (`chrome.storage.sync`).
    *   Handles tab capture requests (`chrome.tabs.captureVisibleTab`).
3.  **Popup (`popup/`):**
    *   Provides the user interface to start/stop the automation.
    *   Displays the current status (running, stopped, error), API connection status, model name, and quiz progress.
    *   Communicates with the content script to trigger actions and get status updates.
4.  **Options Page (`options/`):**
    *   Allows users to configure settings:
        *   Google Gemini API Key (Required)
        *   Gemini Model Selection
        *   Answer Delay (seconds)
        *   Sabotage Feature (Enable/Disable)
        *   Number of Incorrect Answers (if Sabotage is enabled)
        *   Retry Attempts
        *   Process Images (Enable/Disable)
    *   Includes a button to test the API key and connection.

## Setup and Installation

1.  **Get a Google Gemini API Key:**
    *   Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
    *   Create an API key. **Keep this key secure and do not share it.**
2.  **Download the Extension:**
    *   Clone this repository or download the source code as a ZIP file and extract it.
3.  **Load the Extension in Chrome:**
    *   Open Chrome and navigate to `chrome://extensions/`.
    *   Enable "Developer mode" using the toggle switch in the top-right corner.
    *   Click the "Load unpacked" button.
    *   Select the directory where you downloaded/extracted the extension code.
4.  **Configure the Extension:**
    *   Click the Apex Assist extension icon in your Chrome toolbar.
    *   Go to "Options" (you might need to right-click the icon and select "Options").
    *   Enter your Google Gemini API key.
    *   Adjust other settings like the model (ensure your API key has access to the selected model), delay, and sabotage options as desired.
    *   Click "Save". You can use the "Test Connection" button to verify your API key.

## Usage

1.  Navigate to an Apex Learning quiz or test page.
2.  Click the Apex Assist extension icon in your Chrome toolbar.
3.  The popup will show the status. If on a valid Apex page and the API key is configured, you should see "Ready".
4.  Click the "Start" button to begin the automation.
5.  The extension will start answering questions. You can monitor the progress in the popup.
6.  Click the "Stop" button at any time to halt the automation.

## Disclaimer

This extension is intended for educational purposes and experimentation only. Using this tool to cheat on academic assignments violates academic integrity policies. The developers are not responsible for any misuse of this extension or any consequences resulting from such misuse. Use responsibly and ethically.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details (Note: You'll need to add a LICENSE file containing the MIT license text to your repository). 
