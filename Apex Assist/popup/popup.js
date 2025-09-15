// Created by Bzzimmy
// Subscribe to my YouTube: https://www.youtube.com/@bzzimmy

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const statusMessage = document.getElementById('status-message');
  const apiStatus = document.getElementById('api-status');
  const apiIndicator = document.getElementById('api-indicator');
  const modelName = document.getElementById('model-name');
  const quizName = document.getElementById('quiz-name');
  const quizProgress = document.getElementById('quiz-progress');

  // Get the current active tab
  async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  // Check if we're on an Apex Learning site
  async function isApexSite() {
    const tab = await getCurrentTab();
    return tab.url.includes('apexvs.com') || tab.url.includes('course.apexlearning.com');
  }

  // Update model name display
  function updateModelInfo() {
    chrome.storage.sync.get('settings', (result) => {
      const settings = result.settings || { provider: 'gemini', model: 'gemini-2.5-flash' };
      const provider = settings.provider || 'gemini';
      const model = settings.model || 'gemini-2.5-flash';

      // Format display based on provider and model
      let displayText = '';
      if (provider === 'gemini') {
        if (model === 'gemini-2.5-flash') {
          displayText = 'Gemini 2.5 Flash';
        } else {
          displayText = 'Gemini 2.0 Flash';
        }
      } else if (provider === 'cerebras') {
        if (model === 'llama-4-scout-17b-16e-instruct') {
          displayText = 'Llama 4 Scout 17B (Cerebras)';
        } else if (model === 'llama-3.1-70b-instruct') {
          displayText = 'Llama 3.1 70B (Cerebras)';
        } else if (model === 'qwen2.5-72b-instruct') {
          displayText = 'Qwen 2.5 72B (Cerebras)';
        } else {
          displayText = `${model} (Cerebras)`;
        }
      } else {
        displayText = `${model} (${provider})`;
      }

      modelName.textContent = displayText;
    });
  }

  // Check API connection status
  async function checkApiConnection() {
    // First check if we have an API key for the selected provider
    chrome.storage.sync.get('settings', (result) => {
      const settings = result.settings || { provider: 'gemini' };
      const provider = settings.provider || 'gemini';
      const apiKey = provider === 'cerebras' ? settings.cerebrasApiKey : settings.geminiApiKey;

      if (!apiKey) {
        apiStatus.textContent = `No ${provider} API Key`;
        apiIndicator.className = 'indicator disconnected';
        return;
      }

      // Test the connection by sending a simple request
      chrome.runtime.sendMessage(
        {
          action: 'callAIProvider',
          input: 'Test connection',
          provider: provider,
          apiKey: apiKey,
          model: settings.model
        },
        response => {
          if (chrome.runtime.lastError || !response || !response.success) {
            apiStatus.textContent = 'Disconnected';
            apiIndicator.className = 'indicator disconnected';
          } else {
            apiStatus.textContent = 'Connected';
            apiIndicator.className = 'indicator connected';
          }
        }
      );
    });
  }

  // Start the automation
  startBtn.addEventListener('click', async () => {
    const isApex = await isApexSite();
    
    if (!isApex) {
      statusMessage.textContent = 'Error: Not on Apex Learning site';
      statusMessage.className = 'status-error';
      return;
    }

    statusMessage.textContent = 'Starting automation...';
    statusMessage.className = 'status-waiting';
    
    const tab = await getCurrentTab();
    
    // Send message to content script to start automation
    chrome.tabs.sendMessage(tab.id, { action: 'startAutomation' }, (response) => {
      if (chrome.runtime.lastError) {
        statusMessage.textContent = 'Error: ' + chrome.runtime.lastError.message;
        statusMessage.className = 'status-error';
        return;
      }
      
      if (response && response.success) {
        statusMessage.textContent = 'Automation running';
        statusMessage.className = 'status-running';
        
        // Update quiz info after starting
        updateQuizInfo();
      } else {
        statusMessage.textContent = response && response.error ? 
          `Failed: ${response.error}` : 'Failed to start automation';
        statusMessage.className = 'status-error';
      }
    });
  });

  // Stop the automation
  stopBtn.addEventListener('click', async () => {
    const tab = await getCurrentTab();
    
    // Send message to content script to stop automation
    chrome.tabs.sendMessage(tab.id, { action: 'stopAutomation' }, (response) => {
      if (chrome.runtime.lastError) {
        statusMessage.textContent = 'Error: ' + chrome.runtime.lastError.message;
        statusMessage.className = 'status-error';
        return;
      }
      
      if (response && response.success) {
        statusMessage.textContent = 'Automation stopped';
        statusMessage.className = 'status-ready';
      } else {
        statusMessage.textContent = 'Failed to stop automation';
        statusMessage.className = 'status-error';
      }
    });
  });

  // Update quiz information
  async function updateQuizInfo() {
    const isApex = await isApexSite();
    
    if (!isApex) {
      quizName.textContent = 'Not on Apex site';
      quizProgress.textContent = '-/-';
      return;
    }
    
    const tab = await getCurrentTab();
    
    chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, (response) => {
      if (chrome.runtime.lastError) {
        // Content script may not be loaded yet
        quizName.textContent = 'Unknown';
        quizProgress.textContent = '-/-';
        return;
      }
      
      if (response && response.quizInfo) {
        // Format the quiz name properly with ellipsis if too long
        quizName.textContent = response.quizInfo.name || 'Unknown';
        
        // Check if quiz is completed
        if (response.quizInfo.completed) {
          quizProgress.textContent = 'Completed';
          quizProgress.className = 'completed-status';
        } else {
          // Format the progress with bold styling
          const current = response.quizInfo.currentQuestion;
          const total = response.quizInfo.totalQuestions;
          quizProgress.textContent = `${current}/${total}`;
          quizProgress.className = '';
        }
      } else {
        quizName.textContent = 'Unknown';
        quizProgress.textContent = '-/-';
      }
    });
  }

  // Check status on popup open
  async function checkStatus() {
    const isApex = await isApexSite();
    
    if (!isApex) {
      statusMessage.textContent = 'Not on Apex Learning site';
      statusMessage.className = 'status-error';
      startBtn.disabled = true;
      stopBtn.disabled = true;
      return;
    }
    
    const tab = await getCurrentTab();
    
    // Check current status
    chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, (response) => {
      if (chrome.runtime.lastError) {
        // Content script may not be loaded yet
        statusMessage.textContent = 'Extension loading...';
        statusMessage.className = 'status-waiting';
        return;
      }
      
      if (response && response.running) {
        statusMessage.textContent = 'Automation running';
        statusMessage.className = 'status-running';
      } else if (response && response.quizInfo && response.quizInfo.completed) {
        statusMessage.textContent = 'Quiz completed';
        statusMessage.className = 'status-ready';
        // Disable start button when quiz is already completed
        startBtn.disabled = true;
      } else {
        statusMessage.textContent = 'Ready';
        statusMessage.className = 'status-ready';
        // Re-enable start button
        startBtn.disabled = false;
      }
      
      // Update quiz info
      if (response && response.quizInfo) {
        quizName.textContent = response.quizInfo.name || 'Unknown';
        
        if (response.quizInfo.completed) {
          quizProgress.textContent = 'Completed';
          quizProgress.className = 'completed-status';
        } else {
          quizProgress.textContent = `${response.quizInfo.currentQuestion}/${response.quizInfo.totalQuestions}`;
          quizProgress.className = '';
        }
      }
    });
  }

  // Set up an interval to periodically update quiz info when the popup is open
  const updateInterval = setInterval(updateQuizInfo, 2000);
  
  // Clean up interval when popup closes
  window.addEventListener('unload', () => {
    clearInterval(updateInterval);
  });

  // Listen for storage changes to update model info
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes.settings) {
      updateModelInfo();
    }
  });

  // Run initial checks
  checkStatus();
  checkApiConnection();
  updateModelInfo();
  updateQuizInfo();
}); 
