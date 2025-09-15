// Created by Bzzimmy
// Subscribe to my YouTube: https://www.youtube.com/@bzzimmy

// Content script for Apex Assist

// Global variables
let automationRunning = false;
let loopStopped = false;
let attempts = 0;
let incorrectAnswers = 0;
let settings = {
  provider: 'gemini',
  geminiApiKey: '',
  cerebrasApiKey: '',
  delay: 5,
  sabotage: true,
  incorrectCount: 2,
  attempts: 3,
  processImages: true
};

// --------------------
// Utility helpers
// --------------------

// Parse quiz progress numbers from the UI
const getProgressInfo = () => {
  const questionInfoText = document.querySelector(".sia-question-number")?.innerText ?? "";
  const questionRegexResult = /Question (.*) of (.*)/.exec(questionInfoText);
  let questionNum = 1;
  let totalQuestions = 1;
  if (questionRegexResult) {
    questionNum = parseInt(questionRegexResult[1]) || 1;
    totalQuestions = parseInt(questionRegexResult[2]) || 1;
  }
  return { questionNum, totalQuestions };
};

// Build a formatted query shown in logs and used as base prompt context
const buildFormattedQuery = (question, answers, isMultipleChoice) => [
  question,
  "",
  "Options:",
  ...new Set(answers.map(({ value }) => value)),
  isMultipleChoice ? "\nNote: This is a multiple-choice question. Select all that apply." : ""
].join("\n");

// Ensure letters are always an array
const coerceLettersArray = (letters) => {
  if (!letters) return [];
  if (Array.isArray(letters)) return letters;
  if (typeof letters === 'string') {
    return letters.includes(',')
      ? letters.split(',').map(l => l.trim())
      : [letters];
  }
  return [];
};

// Map any returned content values back to letters for MC questions
const mapContentToLettersIfNeeded = (letters, isMultipleChoice, answers) => {
  if (!isMultipleChoice || !letters) return letters || [];

  const responseLetters = [];
  for (const item of letters) {
    if (/^[A-F]$/i.test(item)) {
      responseLetters.push(item.toUpperCase());
    } else {
      const match = answers.find(a => a.content.trim().toUpperCase() === (item || '').trim().toUpperCase());
      if (match) {
        responseLetters.push(match.letter);
        console.log(`[Apex Assist] Mapped answer content "${item}" to letter "${match.letter}"`);
      } else {
        console.warn(`[Apex Assist] Couldn't map answer content "${item}" to a letter`);
      }
    }
  }
  return responseLetters;
};

// Parse provider response text into a normalized object { letters: [], explanation?: string }
const parseAIResponseText = (responseText, isMultipleChoice, answers) => {
  console.log("[Apex Assist] Raw provider response:", responseText);
  const jsonMatch = responseText.match(/(\{[\s\S]*\})/);
  if (!jsonMatch || !jsonMatch[1]) {
    throw new Error("Could not parse JSON from provider response");
  }
  const parsed = JSON.parse(jsonMatch[1]);
  parsed.letters = mapContentToLettersIfNeeded(coerceLettersArray(parsed.letters), isMultipleChoice, answers);
  return parsed;
};

// Helper function to create a placeholder answer object (for testing)
const createPlaceholderAnswer = (letter, description) => ({
  value: `${letter}. ${description}`,
  letter,
  select: () => {
    console.log("debug: called select() in answer", letter);
  },
});

// Sleep function for delays
const sleep = (time = 1000) => {
  console.log("[Apex Assist] Sleeping for", time);
  return new Promise((resolve) => setTimeout(() => resolve(), time));
};

// Answer selection helpers
const selectMultipleChoiceAnswers = async (answers, letters, sabotage) => {
  if (sabotage) {
    console.log("[Apex Assist] Sabotaging this multiple-choice question");
    const correctLetters = new Set(letters);
    const allLetters = answers.map(a => a.letter);
    const incorrectLetters = allLetters.filter(l => !correctLetters.has(l));

    if (correctLetters.size > 0) {
      const oneCorrect = Array.from(correctLetters)[0];
      const selected = [oneCorrect, ...incorrectLetters.slice(0, 1)];
      for (const l of selected) {
        const ans = answers.find(a => a.letter === l);
        if (ans) {
          ans.select();
          console.log(`[Apex Assist] Selected ${l} (sabotage mode)`);
          await sleep(500);
        }
      }
    } else {
      for (let i = 0; i < Math.min(2, answers.length); i++) {
        answers[i].select();
        await sleep(500);
      }
    }
    return;
  }

  let selectedAny = false;
  console.log(`[Apex Assist] Attempting to select ${letters.length} answers: ${letters.join(', ')}`);
  for (const l of letters) {
    const ans = answers.find(a => a.letter === l);
    if (ans) {
      console.log(`[Apex Assist] Selecting option ${l}...`);
      ans.select();
      console.log(`[Apex Assist] Selected option ${l} successfully!`);
      selectedAny = true;
      await sleep(700);
    } else {
      console.warn(`[Apex Assist] Could not find answer with letter ${l}`);
    }
  }

  if (selectedAny) return;

  // Fallback by checkbox index
  console.log("[Apex Assist] Falling back to direct checkbox selection");
  const checkboxes = document.querySelectorAll('.mat-checkbox-input, input[type="checkbox"]');
  console.log(`[Apex Assist] Found ${checkboxes.length} checkboxes for direct selection`);
  const indices = letters.map(letter => letter.charCodeAt(0) - 65);
  console.log(`[Apex Assist] Will attempt to select checkboxes at indices: ${indices.join(', ')}`);

  for (const idx of indices) {
    if (idx >= 0 && idx < checkboxes.length) {
      try {
        console.log(`[Apex Assist] Clicking checkbox at index ${idx}...`);
        const parentCheckbox = checkboxes[idx].closest('.mat-checkbox');
        if (parentCheckbox) {
          parentCheckbox.click();
          console.log(`[Apex Assist] Clicked parent checkbox at index ${idx} successfully!`);
        } else {
          checkboxes[idx].click();
          console.log(`[Apex Assist] Directly clicked checkbox at index ${idx} successfully!`);
        }
        await sleep(700);
      } catch (error) {
        console.error(`[Apex Assist] Error clicking checkbox at index ${idx}:`, error);
        try {
          const parent = checkboxes[idx].closest('.mat-checkbox');
          if (parent) {
            parent.click();
            console.log(`[Apex Assist] Clicked parent of checkbox at index ${idx}`);
          }
        } catch (innerError) {
          console.error(`[Apex Assist] Error clicking parent of checkbox at index ${idx}:`, innerError);
        }
      }
    } else {
      console.warn(`[Apex Assist] Index ${idx} is out of range (0-${checkboxes.length - 1})`);
    }
  }

  if (indices.length > 0 && indices.every(i => i < 0 || i >= checkboxes.length)) {
    console.log("[Apex Assist] Trying alternative checkbox selection method");
    const options = document.querySelectorAll('.sia-mc-option, .sia-choice, .choice-item');
    console.log(`[Apex Assist] Found ${options.length} option elements for alternative selection`);
    for (const idx of indices) {
      if (idx >= 0 && idx < options.length) {
        try {
          console.log(`[Apex Assist] Clicking option element at index ${idx}...`);
          options[idx].click();
          console.log(`[Apex Assist] Clicked option at index ${idx} successfully!`);
          await sleep(700);
        } catch (error) {
          console.error(`[Apex Assist] Error clicking option at index ${idx}:`, error);
        }
      }
    }
  }
};

const selectSingleChoiceAnswers = (answers, letters, sabotage) => {
  letters.forEach((letter) => {
    const ans = answers.find((a) => (sabotage ? a.letter !== letter : a.letter === letter));
    if (ans) {
      ans.select();
      if (sabotage) {
        console.log("[Apex Assist] Sabotaging this question, correct answer is", letters, "choosing", ans.letter, "instead");
      }
    }
  });
};

// Build answer arrays
const getAnswersSingleChoice = () => {
  return [...document.querySelectorAll(".sia-input .label")]
    .map((el) => {
      const value = (el.querySelector(".label")?.innerText ?? "").replaceAll("\n", "");
      const letter = value.charAt(0).toUpperCase();
      return {
        value,
        letter,
        content: value.substring(3).trim(),
        select: () => el.click(),
      };
    })
    .filter((answer) => answer.value.trim().length >= 1);
};

const getAnswersMultipleChoice = () => {
  console.log("[Apex Assist] Analyzing multiple choice options...");
  const optionSelectors = ['.sia-mc-option', '.sia-choice', '.mat-checkbox-layout'];
  let mcOptions = [];
  for (const selector of optionSelectors) {
    mcOptions = document.querySelectorAll(selector);
    if (mcOptions.length > 0) {
      console.log(`[Apex Assist] Found options using selector: ${selector}`);
      break;
    }
  }
  const answers = Array.from(mcOptions).map((el, index) => {
    const letterSelectors = ['.sia-choice-letter', 'span[class*="letter"]', '.choice-label'];
    let letterElement = null;
    for (const selector of letterSelectors) {
      letterElement = el.querySelector(selector);
      if (letterElement) {
        console.log(`[Apex Assist] Found letter using selector: ${selector}`);
        break;
      }
    }
    const letter = letterElement ? letterElement.textContent.trim().replace(/[^A-Za-z0-9]/g, '') : String.fromCharCode(65 + index);

    let content = '';
    const labelElement = document.querySelector(`label[for="mat-checkbox-${index + 1}-input"]`);
    if (labelElement) {
      content = labelElement.textContent.trim().replace(/^[A-Z]\.\s*/, '');
      console.log(`[Apex Assist] Found content from label: "${content}"`);
    }

    if (!content) {
      const contentSelectors = ['.sia-mc-option-text', '.choice-text', '.mat-checkbox-label', 'span:not([class*="letter"])'];
      let contentElement = null;
      for (const selector of contentSelectors) {
        contentElement = el.querySelector(selector);
        if (contentElement) {
          console.log(`[Apex Assist] Found content using selector: ${selector}`);
          content = contentElement.textContent.trim();
          break;
        }
      }
    }

    if (!content) {
      content = el.textContent.trim().replace(/^[A-Z]\.\s*/, '');
      console.log(`[Apex Assist] Using full element text: "${content}"`);
    }

    if (!content) {
      const nextSibling = el.nextElementSibling;
      if (nextSibling) {
        content = nextSibling.textContent.trim();
        console.log(`[Apex Assist] Found content in next sibling: "${content}"`);
      }
    }

    if (!content || content.length < 2) {
      content = `Option ${letter}`;
      console.warn(`[Apex Assist] Using fallback content for option ${letter}`);
    }

    let checkbox = null;
    const checkboxSelectors = ['.mat-checkbox', 'input[type="checkbox"]', '.checkbox'];
    for (const selector of checkboxSelectors) {
      checkbox = el.querySelector(selector) || el.closest(selector);
      if (checkbox) {
        console.log(`[Apex Assist] Found checkbox using selector: ${selector}`);
        break;
      }
    }
    if (!checkbox) checkbox = el;

    console.log(`[Apex Assist] Mapped option: Letter=${letter}, Content=\"${content.substring(0, 50)}${content.length > 50 ? '...' : ''}\"`);
    return {
      value: `${letter}. ${content}`,
      letter,
      content,
      select: () => {
        console.log(`[Apex Assist] Selecting checkbox option: ${letter}`);
        try {
          checkbox.click();
          console.log(`[Apex Assist] Clicked checkbox for option ${letter}`);
        } catch (error) {
          console.error(`[Apex Assist] Error clicking checkbox for option ${letter}:`, error);
          try {
            const input = el.querySelector('input[type="checkbox"]');
            if (input) {
              input.click();
              console.log(`[Apex Assist] Clicked input for option ${letter}`);
            } else {
              console.warn(`[Apex Assist] Could not find input for option ${letter}`);
            }
          } catch (innerError) {
            console.error(`[Apex Assist] Error with alternative click for option ${letter}:`, innerError);
          }
        }
      }
    };
  });

  console.log("[Apex Assist] Parsed answers:", answers.map(a => ({ letter: a.letter, content: a.content })));
  return answers;
};

// Get quiz name from UI
const getQuizName = () => {
  // Try to get the quiz name from the breadcrumb element shown in the screenshot
  const breadcrumbElement = document.querySelector("[class*='toolbar-title-wrapper']");
  if (breadcrumbElement) {
    const fullText = breadcrumbElement.textContent.trim();
    // Pattern matching for format like "5.1.3 Quiz: Angle Sums of a Polygon and Proofs"
    const quizMatch = fullText.match(/([0-9.]+\s+)?Quiz:\s*(.*)/i);
    if (quizMatch && quizMatch[2]) {
      return quizMatch[2].trim();
    }
    return fullText; // Return full text if we can't extract the quiz name portion
  }
  
  // Fallback to individual elements
  const quizTypeElement = document.querySelector(".toolbar-title-type");
  const quizTitleElement = document.querySelector(".toolbar-title");
  
  if (quizTypeElement && quizTitleElement) {
    const quizType = quizTypeElement.textContent.trim();
    const quizTitle = quizTitleElement.textContent.trim();
    return `${quizTitle}`;
  }
  
  // If we still can't find it, try the breadcrumb text directly
  const breadcrumbText = document.querySelector("[class*='toolbar-title']");
  if (breadcrumbText) {
    return breadcrumbText.textContent.trim();
  }
  
  return "Unknown Quiz";
};

// Check if the quiz has been completed
const isQuizCompleted = () => {
  // Direct check for a clear completion header
  const completionElement = document.querySelector('.summary-title-header');
  if (completionElement && completionElement.textContent.trim().includes('Completed')) {
    console.log('[Apex Assist] Quiz completion detected');
    return true;
  }

  // Fallback: scan likely containers and check text content
  const candidates = [
    '.completion-status',
    '[class*="completed-message"]',
    '.quiz-summary h2',
    '.quiz-summary',
  ];

  for (const selector of candidates) {
    const el = document.querySelector(selector);
    if (el && /Completed/i.test(el.textContent || '')) {
      console.log('[Apex Assist] Quiz completion detected via alternative element');
      return true;
    }
  }

  return false;
};

// Placeholder content for testing
const PLACEHOLDER_QUESTION =
  "According to the CIA Triad, which situation is the best example of confidentiality of data?";

const PLACEHOLDER_ANSWERS = [
  createPlaceholderAnswer(
    "A",
    "A hospital hires a specialist to make sure medical records are accurate and reviewed for any errors.",
  ),
  createPlaceholderAnswer(
    "B",
    "An app developer merges user data from two separate accounts but only has access to the data needed to do their job.",
  ),
  createPlaceholderAnswer(
    "C",
    "A website that sells concert tickets online makes all customers use CAPTCHA to complete their transactions.",
  ),
  createPlaceholderAnswer(
    "D",
    "An educational company provides 24-hour web access to its training videos.",
  ),
];

// Capture the visible tab as a base64 PNG
async function captureVisibleTabToBase64() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'captureVisibleTab' }, response => {
      if (chrome.runtime.lastError) {
        console.error('[Apex Assist] Error capturing visible tab:', chrome.runtime.lastError.message);
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response && response.success && response.dataUrl) {
        console.log('[Apex Assist] Successfully captured visible tab.');
        // Extract base64 data
        const base64Data = response.dataUrl.split(',')[1];
        resolve([{
          mimeType: "image/png",
          data: base64Data
        }]);
      } else {
         console.error('[Apex Assist] Failed to capture visible tab. Response:', response);
         reject(new Error(response.error || 'Failed to capture visible tab'));
      }
    });
  });
}

// Function to get context (question and answers)
const getContext = async () => {
  let question;
  let answers;
  let questionNum = 1;
  let totalQuestions = 1;
  let questionElement = null;
  let questionImages = [];
  let isMultipleChoice = false;

  if (typeof window === "undefined") {
    console.warn("[Apex Assist] Cannot automatically retrieve query in node environment");
    question = PLACEHOLDER_QUESTION;
    answers = PLACEHOLDER_ANSWERS;
  } else {
    questionElement = document.querySelector(".sia-question-stem");
    question = questionElement?.innerText ?? "";

    // Process images if image processing is enabled - capture visible tab
    if (settings.processImages) {
      try {
        console.log('[Apex Assist] Capturing visible tab...');
        questionImages = await captureVisibleTabToBase64();
      } catch (error) {
         console.error('[Apex Assist] Failed to capture screen:', error);
         questionImages = []; // Ensure it's an empty array on failure
      }
    }

    // Check if this is a multiple choice (checkbox) question
    const checkboxes = document.querySelectorAll(".mat-checkbox-input");
    isMultipleChoice = checkboxes.length > 0;
    
    console.log(`[Apex Assist] Question type: ${isMultipleChoice ? 'Multiple Choice' : 'Single Choice'}`);
    
    answers = isMultipleChoice ? getAnswersMultipleChoice() : getAnswersSingleChoice();

    const progress = getProgressInfo();
    questionNum = progress.questionNum;
    totalQuestions = progress.totalQuestions;
  }

  return {
    question,
    answers,
    questionNum,
    totalQuestions,
    images: questionImages,
    isMultipleChoice,
    formattedQuery: buildFormattedQuery(question, answers, isMultipleChoice),
  };
};

// Function to determine if we should deliberately provide an incorrect answer
const shouldSabotage = (totalQuestions) => {
  if (!settings.sabotage) {
    return false;
  }

  if (totalQuestions <= settings.incorrectCount) {
    return false;
  }

  if (incorrectAnswers >= settings.incorrectCount) {
    return false;
  }

  return Math.random() < 40 / 100; // 40% chance of sabotage
};

// Main function to call AI Provider API
const callAIProvider = async (formattedQuery, images = [], isMultipleChoice = false, answers = []) => {
  try {
    // Query with prompt
    let input = `${formattedQuery}\\n\\n`;
    
    // Add image context if available
    if (images && images.length > 0) {
      // Update prompt to mention full screen context
      input += `Note: An image of the entire screen is provided. Analyze the visual context along with the text to help determine the correct answer.\\n\\n`;
      console.log(`[Apex Assist] Including 1 full screen image in API request`);
    }
    
    if (isMultipleChoice) {
      input += 'Task: This is a multiple-choice question where MULTIPLE answers can be correct. You MUST identify ALL correct options.\n';
      input += 'Return ALL correct options in an array, even if there are multiple correct answers.\n';
      input += 'Provide your answer in the format: {"letters": ["A", "C", "E"], "explanation": "[Few words explaining why the choices are correct]"}\n';
      input += 'IMPORTANT: The letters array should contain ALL correct options, not just one. If multiple options are correct, include ALL of them in the array.\n';
      input += 'For example, if options A, C, and E are correct, your response should include ["A", "C", "E"] in the letters array.\n';
      input += 'IMPORTANT: When specifying answers, use ONLY the option letters (A, B, C, etc.) in your response. DO NOT use the content of the answers like "SAS", "LL", etc.\n';
      
      // Create a reference for the AI to understand the mapping
      input += "\\nFor reference, here are the options:\\n";
      answers.forEach(answer => {
        input += `${answer.letter}. ${answer.content}\\n`;
      });
    } else {
      input += 'Task: Identify the single best option. Provide your answer in the format: {"letters": ["A"], "explanation": "[Few words explaining why the choice is correct]"}\n';
    }
    
    // Log the final input being sent (excluding image data for brevity)
    console.log(`[Apex Assist] Sending query to ${settings.provider} API:`, input.substring(0, 500) + (input.length > 500 ? '...' : ''));

    // Get the appropriate API key based on provider
    const apiKey = settings.provider === 'cerebras' ? settings.cerebrasApiKey : settings.geminiApiKey;

    if (!apiKey) {
      throw new Error(`${settings.provider} API key not configured`);
    }

    // Call background script to make the API request
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: 'callAIProvider',
          input,
          images,
          provider: settings.provider,
          apiKey: apiKey,
          model: settings.model
        },
        response => {
          if (chrome.runtime.lastError) {
            return reject(new Error(chrome.runtime.lastError.message));
          }
          
          if (!response.success) {
            return reject(new Error(response.error || 'Unknown error'));
          }
          
          try {
            const responseText = response.data.candidates[0].content.parts[0].text;
            const parsed = parseAIResponseText(responseText, isMultipleChoice, answers);
            console.log("[Apex Assist] Parsed JSON response:", parsed);
            return resolve(parsed);
          } catch (error) {
            return reject(error);
          }
        }
      );
    });
  } catch (error) {
    console.error(`[Apex Assist] Error calling ${settings.provider} API:`, error);
    throw error;
  }
};

// Main automation function
const runAutomation = async () => {
  if (attempts >= settings.attempts) {
    console.log(`[Apex Assist] Giving up after ${attempts} attempts`);
    automationRunning = false;
    return;
  }

  attempts++;

  const { formattedQuery, answers, question, questionNum, totalQuestions, images, isMultipleChoice } = await getContext();

  if (question.trim().length < 1) {
    console.log("[Apex Assist] Cannot get question, exiting");
    automationRunning = false;
    return;
  }

  if (loopStopped) {
    console.log("[Apex Assist] Loop forcefully stopped, exiting");
    automationRunning = false;
    return;
  }

  console.log(`[Apex Assist] Question ${questionNum} of ${totalQuestions}:`);
  console.log(formattedQuery);
  console.log(`[Apex Assist] Images: ${images.length}`);
  console.log(`[Apex Assist] Multiple Choice: ${isMultipleChoice}`);

  try {
    // Pass the answers array to the API function to help with content-to-letter mapping
    const answer = await callAIProvider(formattedQuery, images, isMultipleChoice, answers);
    console.log(`[Apex Assist] Answer result:`, answer);

    if (!answer || !answer.letters || answer.letters.length === 0) {
      console.log("[Apex Assist] Failed to retrieve a valid answer");
      setTimeout(() => runAutomation(), 1000);
      return;
    }

    attempts = 0;

    const sabotage = shouldSabotage(totalQuestions);
    
    if (isMultipleChoice) {
      await selectMultipleChoiceAnswers(answers, answer.letters, sabotage);
    } else {
      selectSingleChoiceAnswers(answers, answer.letters, sabotage);
    }

    // Wait before submitting
    await sleep(settings.delay * 1000);

    // Submit
    document.querySelector("kp-question-controls button")?.click();

    await sleep(1000);

    // Check if answer was incorrect
    const answerTextEl = document.querySelector(".feedback-body.active kp-feedback-header span.header-text");
    const isIncorrect = answerTextEl?.innerText === "Incorrect";
    
    if (isIncorrect) {
      console.log("[Apex Assist] Answer is incorrect");
      incorrectAnswers++;
    }

    // Next question
    document.querySelector("kp-question-controls button")?.click();

    await sleep(1000);

    // Continue automation if still running
    if (automationRunning) {
      runAutomation();
    }
  } catch (error) {
    console.error("[Apex Assist] Error during automation:", error);
    
    // Try again after a delay
    setTimeout(() => {
      if (automationRunning) {
        runAutomation();
      }
    }, 2000);
  }
};

// Function to start automation
const startAutomation = async () => {
  if (automationRunning) {
    return;
  }
  
  // Get settings from storage
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
      if (response && response.settings) {
        settings = response.settings;
        
        // Check if API key is set for the selected provider
        const apiKey = settings.provider === 'cerebras' ? settings.cerebrasApiKey : settings.geminiApiKey;
        if (!apiKey) {
          console.error(`[Apex Assist] ${settings.provider} API key not set. Please set it in options.`);
          resolve({ success: false, error: `${settings.provider} API key not set` });
          return;
        }
        
        // Reset counters
        attempts = 0;
        incorrectAnswers = 0;
        loopStopped = false;
        automationRunning = true;
        
        // Start automation
        runAutomation();
        resolve({ success: true });
      } else {
        resolve({ success: false, error: 'Could not load settings' });
      }
    });
  });
};

// Function to stop automation
const stopAutomation = () => {
  loopStopped = true;
  automationRunning = false;
  return { success: true };
};

// Listen for messages from popup and hotkey
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'startAutomation':
      startAutomation().then(sendResponse);
      return true;

    case 'stopAutomation':
      sendResponse(stopAutomation());
      return false;

    case 'toggleAutomation':
      // Handle hotkey toggle (discreet - no visual feedback)
      if (automationRunning) {
        sendResponse(stopAutomation());
      } else {
        startAutomation().then(sendResponse);
      }
      return true;

    case 'getStatus':
      // Get quiz info
      const quizName = getQuizName();
      
      // Check if quiz is completed
      const completed = isQuizCompleted();
      
      // Get question progress
      let questionNum = 1;
      let totalQuestions = 1;
      
      const questionInfoText = document.querySelector(".sia-question-number")?.innerText ?? "";
      const questionRegexResult = /Question (.*) of (.*)/.exec(questionInfoText);
      if (questionRegexResult) {
        questionNum = parseInt(questionRegexResult[1]) || 1;
        totalQuestions = parseInt(questionRegexResult[2]) || 1;
      }
      
      sendResponse({ 
        running: automationRunning,
        quizInfo: {
          name: quizName,
          currentQuestion: questionNum,
          totalQuestions: totalQuestions,
          completed: completed
        }
      });
      return false;
  }
});

// Function to autoclick through study materials
const autoclickStudy = async () => {
  // Activity Completed
  const activityCompletedYes = document.querySelector(".cdk-overlay-pane mat-dialog-container .mat-dialog-actions button:nth-child(2)");

  if (activityCompletedYes) {
    activityCompletedYes.click();
    return;
  }
  
  const next = document.querySelector("kp-nav-footer kp-content-lane .nav-section:nth-child(3) button");
  if (!next) {
    return;
  }
  next.click();

  await sleep(1000);

  return autoclickStudy();
}; 
