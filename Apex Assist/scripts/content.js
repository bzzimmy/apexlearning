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
  // Check for the completion element that appears when a quiz is finished
  const completionElement = document.querySelector(".summary-title-header");
  
  if (completionElement && completionElement.textContent.trim() === "Completed") {
    console.log("[Apex Assist] Quiz completion detected");
    return true;
  }
  
  // Additional checks - sometimes the completion status might appear in other elements
  const otherCompletionIndicators = [
    ".completion-status:contains('Completed')",
    "[class*='completed-message']",
    ".quiz-summary h2:contains('Completed')"
  ];
  
  for (const selector of otherCompletionIndicators) {
    try {
      const element = document.querySelector(selector);
      if (element && element.textContent.includes("Completed")) {
        console.log("[Apex Assist] Quiz completion detected via alternative element");
        return true;
      }
    } catch (error) {
      // Some advanced selectors might not be supported, ignore errors
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
    
    if (isMultipleChoice) {
      console.log("[Apex Assist] Analyzing multiple choice options...");
      
      // Log all available options for debugging
      const optionElements = document.querySelectorAll('.sia-mc-option, .sia-choice');
      console.log(`[Apex Assist] Found ${optionElements.length} option elements`);
      
      // Dump the HTML structure of the first option for debugging
      if (optionElements.length > 0) {
        console.log("[Apex Assist] First option HTML:", optionElements[0].outerHTML);
      }
      
      // Try several selectors to find the options
      const optionSelectors = [
        '.sia-mc-option',
        '.sia-choice',
        '.mat-checkbox-layout'
      ];
      
      let mcOptions = [];
      for (const selector of optionSelectors) {
        mcOptions = document.querySelectorAll(selector);
        if (mcOptions.length > 0) {
          console.log(`[Apex Assist] Found options using selector: ${selector}`);
          break;
        }
      }
      
      // Handle multiple choice (checkbox) questions
      answers = Array.from(mcOptions).map((el, index) => {
        // Look for letter elements with different selectors
        const letterSelectors = [
          '.sia-choice-letter',
          'span[class*="letter"]',
          '.choice-label'
        ];
        
        let letterElement = null;
        for (const selector of letterSelectors) {
          letterElement = el.querySelector(selector);
          if (letterElement) {
            console.log(`[Apex Assist] Found letter using selector: ${selector}`);
            break;
          }
        }
        
        // Find the letter for this option (A, B, C, etc.)
        // If we can't find it using selectors, use the index
        const letter = letterElement 
          ? letterElement.textContent.trim().replace(/[^A-Za-z0-9]/g, '')
          : String.fromCharCode(65 + index);
        
        // First try with the new direct approach - capture label text directly
        let content = '';
        
        // Try to get text from label - handles the case shown in the screenshot
        const labelElement = document.querySelector(`label[for="mat-checkbox-${index+1}-input"]`);
        if (labelElement) {
          // Remove "A. ", "B. " etc. from the beginning
          content = labelElement.textContent.trim().replace(/^[A-Z]\.\s*/, '');
          console.log(`[Apex Assist] Found content from label: "${content}"`);
        }
        
        // If that didn't work, try other selectors
        if (!content) {
          const contentSelectors = [
            '.sia-mc-option-text',
            '.choice-text',
            '.mat-checkbox-label',
            'span:not([class*="letter"])'
          ];
          
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
        
        // If still no content, try to get the entire text and remove the letter
        if (!content) {
          content = el.textContent.trim().replace(/^[A-Z]\.\s*/, '');
          console.log(`[Apex Assist] Using full element text: "${content}"`);
        }
        
        // If content is still empty, try one more approach - find nearby text
        if (!content) {
          // Look for adjacent text element
          const nextSibling = el.nextElementSibling;
          if (nextSibling) {
            content = nextSibling.textContent.trim();
            console.log(`[Apex Assist] Found content in next sibling: "${content}"`);
          }
        }
        
        // If content is still empty or too short, use a fallback
        if (!content || content.length < 2) {
          content = `Option ${letter}`;
          console.warn(`[Apex Assist] Using fallback content for option ${letter}`);
        }
        
        // Get the checkbox element
        let checkbox = null;
        const checkboxSelectors = [
          '.mat-checkbox',
          'input[type="checkbox"]',
          '.checkbox'
        ];
        
        for (const selector of checkboxSelectors) {
          checkbox = el.querySelector(selector) || el.closest(selector);
          if (checkbox) {
            console.log(`[Apex Assist] Found checkbox using selector: ${selector}`);
            break;
          }
        }
        
        // As a fallback, use the parent element itself
        if (!checkbox) {
          checkbox = el;
        }
        
        console.log(`[Apex Assist] Mapped option: Letter=${letter}, Content="${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`);
        
        return {
          value: `${letter}. ${content}`,
          letter,
          content,
          select: () => {
            console.log(`[Apex Assist] Selecting checkbox option: ${letter}`);
            try {
              // Try to click the checkbox element
              checkbox.click();
              console.log(`[Apex Assist] Clicked checkbox for option ${letter}`);
            } catch (error) {
              console.error(`[Apex Assist] Error clicking checkbox for option ${letter}:`, error);
              
              // Alternative: try to find the input directly and click it
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
      
      // Log all parsed answers for debugging
      console.log("[Apex Assist] Parsed answers:", answers.map(a => ({ letter: a.letter, content: a.content })));
    } else {
      // Handle regular single choice questions
      answers = [...document.querySelectorAll(".sia-input .label")]
        .map((el) => {
          const value = (
            el.querySelector(".label")?.innerText ?? ""
          ).replaceAll("\n", "");
          const letter = value.charAt(0).toUpperCase();

          return {
            value,
            letter,
            content: value.substring(3).trim(),
            select: () => {
              el.click();
            },
          };
        })
        .filter((answer) => answer.value.trim().length >= 1);
    }

    const questionInfoText = document.querySelector(".sia-question-number")?.innerText ?? "";
    const questionRegexResult = /Question (.*) of (.*)/.exec(questionInfoText);
    if (questionRegexResult) {
      questionNum = parseInt(questionRegexResult[1]) || 1;
      totalQuestions = parseInt(questionRegexResult[2]) || 1;
    }
  }

  return {
    question,
    answers,
    questionNum,
    totalQuestions,
    images: questionImages,
    isMultipleChoice,
    formattedQuery: [
      question,
      "",
      "Options:",
      ...new Set(answers.map(({ value }) => value)),
      isMultipleChoice ? "\nNote: This is a multiple-choice question. Select all that apply." : ""
    ].join("\n"),
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
      input += "Task: This is a multiple-choice question where MULTIPLE answers can be correct. You MUST identify ALL correct options.\\n";
      input += "Return ALL correct options in an array, even if there are multiple correct answers.\\n";
      // Corrected JSON format string
      input += 'Provide your answer in the format: {\\\"letters\\\": [\\\"A\\\", \\\"C\\\", \\\"E\\\"], \\\"explanation\\\": \\\"[Few words explaining why the choices are correct]\\\".\\n';
      input += "IMPORTANT: The letters array should contain ALL correct options, not just one. If multiple options are correct, include ALL of them in the array.\\n";
      input += "For example, if options A, C, and E are correct, your response should include [\\\"A\\\", \\\"C\\\", \\\"E\\\"] in the letters array.\\n";
      input += "IMPORTANT: When specifying answers, use ONLY the option letters (A, B, C, etc.) in your response. DO NOT use the content of the answers like 'SAS', 'LL', etc.\\n";
      
      // Create a reference for the AI to understand the mapping
      input += "\\nFor reference, here are the options:\\n";
      answers.forEach(answer => {
        input += `${answer.letter}. ${answer.content}\\n`;
      });
    } else {
      // Corrected JSON format string
      input += 'Task: Identify the correct option that best answers the provided question and provide your answer in the format: {\\\"letters\\\": [\\\"Letter(s) to the correct options\\\"], \\\"explanation\\\": \\\"[Few words explaining why the choice is correct]\\\}.\\n';
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
            // Extract the text content from API response
            const responseText = response.data.candidates[0].content.parts[0].text;
            console.log(`[Apex Assist] Raw ${settings.provider} response:`, responseText);
            
            // Parse JSON from the response
            const jsonMatch = responseText.match(/(\{[\s\S]*\})/);
            if (jsonMatch && jsonMatch[1]) {
              const parsed = JSON.parse(jsonMatch[1]);
              console.log("[Apex Assist] Parsed JSON response:", parsed);
              
              // Make sure letters is always an array
              if (parsed.letters && !Array.isArray(parsed.letters)) {
                if (typeof parsed.letters === 'string') {
                  // If it's a string, split it if it contains multiple letters
                  if (parsed.letters.includes(',')) {
                    parsed.letters = parsed.letters.split(',').map(l => l.trim());
                  } else {
                    // If it's a single letter string, convert to array
                    parsed.letters = [parsed.letters];
                  }
                } else {
                  // Fallback to empty array if it's neither array nor string
                  parsed.letters = [];
                }
                console.log("[Apex Assist] Converted letters to array:", parsed.letters);
              }
              
              // If we get content instead of letters in a multiple choice question,
              // try to map content to letters
              if (isMultipleChoice && parsed.letters) {
                const responseLetters = [];
                
                for (const item of parsed.letters) {
                  // Check if this is already a letter (A, B, C, etc.)
                  if (/^[A-F]$/.test(item)) {
                    responseLetters.push(item);
                  } else {
                    // This might be content like "SAS" or "HL" - try to find matching letter
                    const matchingAnswer = answers.find(answer => 
                      answer.content.trim().toUpperCase() === item.trim().toUpperCase());
                    
                    if (matchingAnswer) {
                      responseLetters.push(matchingAnswer.letter);
                      console.log(`[Apex Assist] Mapped answer content "${item}" to letter "${matchingAnswer.letter}"`);
                    } else {
                      console.warn(`[Apex Assist] Couldn't map answer content "${item}" to a letter`);
                    }
                  }
                }
                
                // Replace the letters array with our mapped version
                parsed.letters = responseLetters;
              }
              
              return resolve(parsed);
            }
            return reject(new Error(`Could not parse JSON from ${settings.provider} response`));
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
      // Handle multiple choice (checkbox) selection
      if (sabotage) {
        console.log("[Apex Assist] Sabotaging this multiple-choice question");
        // For sabotage on multiple choice, we'll select a mix of correct and incorrect
        const correctLetters = new Set(answer.letters);
        const allLetters = answers.map(a => a.letter);
        
        // Select some incorrect options
        const incorrectLetters = allLetters.filter(l => !correctLetters.has(l));
        
        // Select at least one correct answer to not be too obvious
        if (correctLetters.size > 0) {
          const oneCorrectLetter = Array.from(correctLetters)[0];
          const selectedLetters = [oneCorrectLetter, ...incorrectLetters.slice(0, 1)];
          
          // Select the answers with a delay between each
          for (const letter of selectedLetters) {
            const answerObj = answers.find(a => a.letter === letter);
            if (answerObj) {
              answerObj.select();
              console.log(`[Apex Assist] Selected ${letter} (sabotage mode)`);
              await sleep(500); // Add a small delay between selections
            }
          }
        } else {
          // Just pick random answers
          for (let i = 0; i < Math.min(2, answers.length); i++) {
            answers[i].select();
            await sleep(500); // Add a small delay between selections
          }
        }
      } else {
        // Normal selection for multiple choice
        let selectedAny = false;
        
        console.log(`[Apex Assist] Attempting to select ${answer.letters.length} answers: ${answer.letters.join(', ')}`);
        
        // First try to select by letter
        for (const letter of answer.letters) {
          const answerObj = answers.find(a => a.letter === letter);
          if (answerObj) {
            console.log(`[Apex Assist] Selecting option ${letter}...`);
            answerObj.select();
            console.log(`[Apex Assist] Selected option ${letter} successfully!`);
            selectedAny = true;
            await sleep(700); // Add a delay between selections for visibility
          } else {
            console.warn(`[Apex Assist] Could not find answer with letter ${letter}`);
          }
        }
        
        // If we couldn't select any options by letter, try direct selection by index
        if (!selectedAny) {
          console.log("[Apex Assist] Falling back to direct checkbox selection");
          
          // Try to directly select checkboxes based on index in the response
          // This is a fallback method if we can't match letters
          const checkboxes = document.querySelectorAll('.mat-checkbox-input, input[type="checkbox"]');
          console.log(`[Apex Assist] Found ${checkboxes.length} checkboxes for direct selection`);
          
          // Map AI response letters to indices (A=0, B=1, etc.)
          const indices = answer.letters.map(letter => letter.charCodeAt(0) - 65);
          console.log(`[Apex Assist] Will attempt to select checkboxes at indices: ${indices.join(', ')}`);
          
          for (const index of indices) {
            if (index >= 0 && index < checkboxes.length) {
              try {
                // Try to click the checkbox
                console.log(`[Apex Assist] Clicking checkbox at index ${index}...`);
                
                // Use parent .mat-checkbox element instead of the input directly
                const parentCheckbox = checkboxes[index].closest('.mat-checkbox');
                if (parentCheckbox) {
                  parentCheckbox.click();
                  console.log(`[Apex Assist] Clicked parent checkbox at index ${index} successfully!`);
                } else {
                  // Fallback to direct input click
                  checkboxes[index].click();
                  console.log(`[Apex Assist] Directly clicked checkbox at index ${index} successfully!`);
                }
                
                await sleep(700); // Add a delay between selections for visibility
              } catch (error) {
                console.error(`[Apex Assist] Error clicking checkbox at index ${index}:`, error);
                
                // Try clicking the parent
                try {
                  const parent = checkboxes[index].closest('.mat-checkbox');
                  if (parent) {
                    parent.click();
                    console.log(`[Apex Assist] Clicked parent of checkbox at index ${index}`);
                  }
                } catch (innerError) {
                  console.error(`[Apex Assist] Error clicking parent of checkbox at index ${index}:`, innerError);
                }
              }
            } else {
              console.warn(`[Apex Assist] Index ${index} is out of range (0-${checkboxes.length-1})`);
            }
          }
          
          // As a last resort, try an alternative selector
          if (indices.length > 0 && indices.every(i => i < 0 || i >= checkboxes.length)) {
            console.log("[Apex Assist] Trying alternative checkbox selection method");
            
            // Try to find checkboxes by alternative means
            const options = document.querySelectorAll('.sia-mc-option, .sia-choice, .choice-item');
            console.log(`[Apex Assist] Found ${options.length} option elements for alternative selection`);
            
            for (const index of indices) {
              if (index >= 0 && index < options.length) {
                try {
                  console.log(`[Apex Assist] Clicking option element at index ${index}...`);
                  options[index].click();
                  console.log(`[Apex Assist] Clicked option at index ${index} successfully!`);
                  await sleep(700);
                } catch (error) {
                  console.error(`[Apex Assist] Error clicking option at index ${index}:`, error);
                }
              }
            }
          }
        }
      }
    } else {
      // Original behavior for single choice questions
      answer.letters.forEach((letter) => {
        const answerObj = answers.find((a) => sabotage ? a.letter !== letter : a.letter === letter);
        if (answerObj) {
          answerObj.select();

          if (sabotage) {
            console.log("[Apex Assist] Sabotaging this question, correct answer is", answer.letters, "choosing", answerObj.letter, "instead");
          }
        }
      });
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