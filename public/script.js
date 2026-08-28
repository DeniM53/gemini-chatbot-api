const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const themeToggleBtn = document.getElementById('theme-toggle');

const uploadBtn = document.getElementById('upload-btn');
const imageInput = document.getElementById('image-input');
const imagePreviewWrapper = document.getElementById('image-preview-wrapper');
const imagePreview = document.getElementById('image-preview');
const clearImageBtn = document.getElementById('clear-image-btn');

let selectedImageBase64 = null;
let selectedImageMimeType = null;
let selectedImageDataUrl = null;

// Load and apply saved theme preference
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
  document.body.classList.add('dark-mode');
  if (themeToggleBtn) themeToggleBtn.textContent = '☀️ Light Mode';
}

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    themeToggleBtn.textContent = isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode';
  });
}

// Trigger file input when upload button is clicked
if (uploadBtn && imageInput) {
  uploadBtn.addEventListener('click', () => {
    imageInput.click();
  });
}

// Handle image selection
if (imageInput) {
  imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
      selectedImageDataUrl = event.target.result;

      // Extract base64 and mime type
      const matches = selectedImageDataUrl.match(/^data:(image\/[a-zA-Z+-\.]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        selectedImageMimeType = matches[1];
        selectedImageBase64 = matches[2];

        // Update UI preview
        if (imagePreview && imagePreviewWrapper) {
          imagePreview.src = selectedImageDataUrl;
          imagePreviewWrapper.style.display = 'flex';
        }
      }
    };
    reader.readAsDataURL(file);
  });
}

// Clear selected image
if (clearImageBtn) {
  clearImageBtn.addEventListener('click', () => {
    clearImageSelection();
  });
}

function clearImageSelection() {
  if (imageInput) imageInput.value = '';
  selectedImageBase64 = null;
  selectedImageMimeType = null;
  selectedImageDataUrl = null;
  if (imagePreview) imagePreview.src = '';
  if (imagePreviewWrapper) imagePreviewWrapper.style.display = 'none';
}

// Array to store the conversation history in the format expected by the backend
const conversation = [];

form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const userMessage = input.value.trim();
  if (!userMessage && !selectedImageBase64) return;

  // Add the user's message to the UI
  appendMessage('user', userMessage, selectedImageDataUrl);
  input.value = '';

  // Store the message in the conversation history
  conversation.push({
    role: 'user',
    text: userMessage,
    image: selectedImageBase64,
    mimeType: selectedImageMimeType
  });

  // Clear the image selection for the next message
  clearImageSelection();

  // Add temporary "Thinking..." bot message to the UI
  const thinkingMessageEl = appendMessage('bot', 'Thinking...');

  // Disable form input and button to prevent double-submit while waiting for API response
  const submitButton = form.querySelector('button[type="submit"]');
  input.disabled = true;
  if (submitButton) submitButton.disabled = true;

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ conversation })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();

    if (data && data.result) {
      // Replace the temporary message with the formatted actual response text
      thinkingMessageEl.innerHTML = formatResponse(data.result);
      // Store the model's response in the conversation history
      conversation.push({ role: 'model', text: data.result });
    } else {
      throw new Error('Invalid response structure or missing result');
    }
  } catch (error) {
    console.error('Error in chat request:', error);
    // Display error message to the user
    thinkingMessageEl.textContent = 'Failed to get response from server.';
  } finally {
    // Re-enable form elements and refocus the input
    input.disabled = false;
    if (submitButton) submitButton.disabled = false;
    input.focus();

    // Scroll chatBox to bottom
    chatBox.scrollTop = chatBox.scrollHeight;
  }
});

function appendMessage(sender, text, imageDataUrl = null) {
  const msg = document.createElement('div');
  msg.classList.add('message', sender);

  if (imageDataUrl) {
    const img = document.createElement('img');
    img.src = imageDataUrl;
    msg.appendChild(img);
  }

  if (text) {
    const textNode = document.createTextNode(text);
    msg.appendChild(textNode);
  }

  chatBox.appendChild(msg);

  // Add a clear div to properly stack the floated messages
  const clear = document.createElement('div');
  clear.style.clear = 'both';
  chatBox.appendChild(clear);

  chatBox.scrollTop = chatBox.scrollHeight;
  return msg;
}

// Helper function to convert raw Gemini API text formatting (markdown-like) into clean HTML
function formatResponse(text) {
  const lines = text.split('\n');
  let html = '';
  let inBulletList = false;
  let inNumList = false;

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inBulletList) {
        html += '</ul>';
        inBulletList = false;
      }
      if (inNumList) {
        html += '</ol>';
        inNumList = false;
      }
      if (html) {
        html += '<br>';
      }
      continue;
    }

    const bulletMatch = trimmed.match(/^[\*\-]\s+(.*)$/);
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);

    if (bulletMatch) {
      if (inNumList) {
        html += '</ol>';
        inNumList = false;
      }
      if (!inBulletList) {
        html += '<ul style="margin: 4px 0; padding-left: 20px;">';
        inBulletList = true;
      }
      html += `<li>${parseInlineMarkdown(bulletMatch[1])}</li>`;
    } else if (numMatch) {
      if (inBulletList) {
        html += '</ul>';
        inBulletList = false;
      }
      if (!inNumList) {
        html += '<ol style="margin: 4px 0; padding-left: 20px;">';
        inNumList = true;
      }
      html += `<li>${parseInlineMarkdown(numMatch[2])}</li>`;
    } else {
      if (inBulletList) {
        html += '</ul>';
        inBulletList = false;
      }
      if (inNumList) {
        html += '</ol>';
        inNumList = false;
      }
      html += `<p style="margin: 4px 0;">${parseInlineMarkdown(trimmed)}</p>`;
    }
  }

  if (inBulletList) html += '</ul>';
  if (inNumList) html += '</ol>';

  return html;
}

// Helper function to escape HTML special characters and render inline markdown (like **bold**)
function parseInlineMarkdown(text) {
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  return escaped.replace(/\*\*(.*?)\*\?/g, '<strong>$1</strong>') // Handle possible trailing question mark within asterisks
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}


