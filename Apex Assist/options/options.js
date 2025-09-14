// Created by Bzzimmy
// Subscribe to my YouTube: https://www.youtube.com/@bzzimmy

document.addEventListener('DOMContentLoaded', () => {
  const optionsForm = document.getElementById('options-form');
  const providerRadios = document.querySelectorAll('input[name="provider"]');
  const geminiApiKeyInput = document.getElementById('gemini-api-key');
  const cerebrasApiKeyInput = document.getElementById('cerebras-api-key');
  const modelSelect = document.getElementById('model');
  const delayInput = document.getElementById('delay');
  const sabotageCheckbox = document.getElementById('sabotage');
  const incorrectCountInput = document.getElementById('incorrect-count');
  const attemptsInput = document.getElementById('attempts');
  const processImagesCheckbox = document.getElementById('process-images');
  const saveBtn = document.getElementById('save-btn');
  const testBtn = document.getElementById('test-btn');
  const closeBtn = document.getElementById('close-btn');
  const statusMessage = document.getElementById('status-message');

  // Default settings
  const DEFAULT_SETTINGS = {
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

  // Load saved settings
  function loadSettings() {
    chrome.storage.sync.get('settings', (data) => {
      const settings = data.settings || DEFAULT_SETTINGS;

      // Set provider radio button
      const providerValue = settings.provider || 'gemini';
      document.querySelector(`input[name="provider"][value="${providerValue}"]`).checked = true;

      geminiApiKeyInput.value = settings.geminiApiKey || '';
      cerebrasApiKeyInput.value = settings.cerebrasApiKey || '';
      modelSelect.value = settings.model || 'gemini-2.0-flash';
      delayInput.value = settings.delay || 5;
      sabotageCheckbox.checked = settings.sabotage !== false;
      incorrectCountInput.value = settings.incorrectCount || 2;
      attemptsInput.value = settings.attempts || 3;
      processImagesCheckbox.checked = settings.processImages !== false;

      // Update model options based on provider
      updateModelOptions(providerValue);
    });
  }

  // Save settings
  function saveSettings(e) {
    e.preventDefault();

    const selectedProvider = document.querySelector('input[name="provider"]:checked').value;

    const settings = {
      provider: selectedProvider,
      geminiApiKey: geminiApiKeyInput.value.trim(),
      cerebrasApiKey: cerebrasApiKeyInput.value.trim(),
      model: modelSelect.value,
      delay: parseInt(delayInput.value, 10),
      sabotage: sabotageCheckbox.checked,
      incorrectCount: parseInt(incorrectCountInput.value, 10),
      attempts: parseInt(attemptsInput.value, 10),
      processImages: processImagesCheckbox.checked
    };

    chrome.storage.sync.set({ settings }, () => {
      showStatus('Settings saved!', 'success');
      setTimeout(() => {
        hideStatus();
      }, 3000);
    });
  }

  // Update model options based on selected provider
  function updateModelOptions(provider) {
    modelSelect.innerHTML = '';

    if (provider === 'gemini') {
      modelSelect.innerHTML = `
        <option value="gemini-2.0-flash">Gemini 2.0 Flash (Default)</option>
        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
      `;
    } else if (provider === 'cerebras') {
      modelSelect.innerHTML = `
        <option value="llama-4-scout-17b-16e-instruct">Llama 4 Scout 17B</option>
        <option value="llama-3.1-70b-instruct">Llama 3.1 70B Instruct</option>
        <option value="qwen2.5-72b-instruct">Qwen 2.5 72B Instruct</option>
      `;
    }

    // Set default model for provider if current model is not available
    const currentModel = modelSelect.value;
    if (!Array.from(modelSelect.options).some(opt => opt.value === currentModel)) {
      if (provider === 'gemini') {
        modelSelect.value = 'gemini-2.0-flash';
      } else if (provider === 'cerebras') {
        modelSelect.value = 'llama-4-scout-17b-16e-instruct';
      }
    }
  }

  // Reset settings to defaults
  function resetSettings() {
    document.querySelector(`input[name="provider"][value="${DEFAULT_SETTINGS.provider}"]`).checked = true;
    geminiApiKeyInput.value = DEFAULT_SETTINGS.geminiApiKey;
    cerebrasApiKeyInput.value = DEFAULT_SETTINGS.cerebrasApiKey;
    modelSelect.value = DEFAULT_SETTINGS.model;
    delayInput.value = DEFAULT_SETTINGS.delay;
    sabotageCheckbox.checked = DEFAULT_SETTINGS.sabotage;
    incorrectCountInput.value = DEFAULT_SETTINGS.incorrectCount;
    attemptsInput.value = DEFAULT_SETTINGS.attempts;
    processImagesCheckbox.checked = DEFAULT_SETTINGS.processImages;

    updateModelOptions(DEFAULT_SETTINGS.provider);
    showStatus('Settings reset to defaults. Click Save to apply.', 'success');
  }

  // Test API connection
  async function testApiConnection() {
    const selectedProvider = document.querySelector('input[name="provider"]:checked').value;
    const apiKey = selectedProvider === 'cerebras' ? cerebrasApiKeyInput.value.trim() : geminiApiKeyInput.value.trim();
    const model = modelSelect.value;

    if (!apiKey) {
      showStatus(`Please enter a ${selectedProvider} API key first`, 'error');
      return;
    }

    showStatus('Testing connection...', 'pending');

    try {
      if (selectedProvider === 'gemini') {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${apiKey}`);
        const data = await response.json();

        if (response.ok && data.name) {
          showStatus(`Connection successful! Model: ${data.displayName || model}`, 'success');
        } else {
          showStatus(`Error: ${data.error?.message || 'Invalid API key or model'}`, 'error');
        }
      } else if (selectedProvider === 'cerebras') {
        // Test Cerebras connection with a simple request
        const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: 'Test connection' }],
            max_tokens: 1
          })
        });

        if (response.ok) {
          showStatus(`Connection successful! Model: ${model}`, 'success');
        } else {
          const errorData = await response.json();
          showStatus(`Error: ${errorData.error?.message || 'Invalid API key or model'}`, 'error');
        }
      }
    } catch (error) {
      showStatus(`Error: ${error.message}`, 'error');
    }
  }

  // Show status message
  function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = type;
    statusMessage.classList.remove('hidden');
  }

  // Hide status message
  function hideStatus() {
    statusMessage.classList.add('hidden');
  }

  // Add event listeners
  optionsForm.addEventListener('submit', saveSettings);
  testBtn.addEventListener('click', testApiConnection);

  // Close the options page
  closeBtn.addEventListener('click', () => {
    window.close();
  });

  // Automatically enable/disable incorrect count based on sabotage checkbox
  sabotageCheckbox.addEventListener('change', () => {
    incorrectCountInput.disabled = !sabotageCheckbox.checked;
  });

  // Add event listeners for provider changes
  providerRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      updateModelOptions(e.target.value);
    });
  });

  // Load settings when the page loads
  loadSettings();
}); 