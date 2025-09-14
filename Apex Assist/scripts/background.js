// Created by Bzzimmy
// Subscribe to my YouTube: https://www.youtube.com/@bzzimmy

// Background script for Apex Assist

// Initialize extension when installed
chrome.runtime.onInstalled.addListener(() => {
  // Set default settings if not already set
  chrome.storage.sync.get('settings', (result) => {
    if (!result.settings) {
      const defaultSettings = {
        provider: 'gemini',
        geminiApiKey: '',
        cerebrasApiKey: '',
        model: 'gemini-2.0-flash',
        delay: 5,
        sabotage: true,
        incorrectCount: 2,
        attempts: 3,
        processImages: true
      };

      chrome.storage.sync.set({ settings: defaultSettings });
    }
  });
});

// Handle hotkey commands
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-automation') {
    // Get the current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab && (tab.url.includes('apexvs.com') || tab.url.includes('course.apexlearning.com'))) {
        // Send message to content script to toggle automation
        chrome.tabs.sendMessage(tab.id, { action: 'toggleAutomation' }, (response) => {
          // Silently handle the toggle - no visual feedback as requested
        });
      }
    });
  }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'callAIProvider') {
    callAIProvider(message.input, message.images, message.provider, message.apiKey, message.model)
      .then(response => {
        sendResponse({ success: true, data: response });
      })
      .catch(error => {
        console.error('Error calling AI Provider:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  }

  if (message.action === 'getSettings') {
    chrome.storage.sync.get('settings', (data) => {
      const settings = data.settings || {
        provider: 'gemini',
        geminiApiKey: '',
        cerebrasApiKey: '',
        model: 'gemini-2.0-flash',
        delay: 5,
        sabotage: true,
        incorrectCount: 2,
        attempts: 3,
        processImages: true
      };
      sendResponse({ settings });
    });
    return true; // Keep the message channel open for async response
  }

  if (message.action === 'captureVisibleTab') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error('[Apex Assist] Error capturing tab in background:', chrome.runtime.lastError.message);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else if (dataUrl) {
        sendResponse({ success: true, dataUrl });
      } else {
        sendResponse({ success: false, error: 'captureVisibleTab returned undefined dataUrl' });
      }
    });
    return true; // Keep the message channel open for async response
  }

  // Optional: Handle unexpected messages
  console.log('[Apex Assist] Received unexpected message:', message);
  // sendResponse({ success: false, error: 'Unknown action' }); // Can uncomment if needed
  return false; // No async response needed for unknown actions
});

// Call the AI Provider API (Gemini or Cerebras)
async function callAIProvider(input, images = [], provider, apiKey, model) {
  console.log(`[Apex Assist] Using ${provider} with model: ${model}`);

  if (provider === 'gemini') {
    return await callGeminiAPI(input, images, apiKey, model);
  } else if (provider === 'cerebras') {
    return await callCerebrasAPI(input, images, apiKey, model);
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }
}

// Call the Gemini API
async function callGeminiAPI(input, images = [], apiKey, model) {
  // Prepare the API URL
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Prepare the request body
  const requestBody = {
    contents: [
      {
        parts: [
          { text: input }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
    }
  };

  // Add images to the request if provided
  if (images && images.length > 0) {
    for (const image of images) {
      requestBody.contents[0].parts.unshift({
        inlineData: {
          mimeType: image.mimeType,
          data: image.data
        }
      });
    }
  }

  try {
    console.log('[Apex Assist] Sending request to Gemini API...');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('[Apex Assist] Received response from Gemini API');

    return data;
  } catch (error) {
    console.error('[Apex Assist] Error in Gemini API call:', error);
    throw error;
  }
}

// Call the Cerebras API
async function callCerebrasAPI(input, images = [], apiKey, model) {
  // Cerebras API endpoint
  const apiUrl = 'https://api.cerebras.ai/v1/chat/completions';

  // Prepare the request body (OpenAI-compatible format)
  const requestBody = {
    model: model,
    messages: [
      {
        role: 'user',
        content: input
      }
    ],
    temperature: 0.2,
    max_tokens: 1024
  };

  // Note: Cerebras may not support images in the same way as Gemini
  // This would need to be implemented based on their specific image handling
  if (images && images.length > 0) {
    console.log('[Apex Assist] Warning: Image processing may not be supported with Cerebras provider');
  }

  try {
    console.log('[Apex Assist] Sending request to Cerebras API...');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('[Apex Assist] Received response from Cerebras API');

    // Convert Cerebras response format to match Gemini format for compatibility
    const convertedResponse = {
      candidates: [{
        content: {
          parts: [{
            text: data.choices[0].message.content
          }]
        }
      }]
    };

    return convertedResponse;
  } catch (error) {
    console.error('[Apex Assist] Error in Cerebras API call:', error);
    throw error;
  }
} 