const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const themeToggleBtn = document.getElementById('theme-toggle');

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

// Array to store the conversation history in the format expected by the backend
const conversation = [];

form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const userMessage = input.value.trim();
  if (!userMessage) return;

  // Add the user's message to the UI
  appendMessage('user', userMessage);
  input.value = '';

  // Store the message in the conversation history
  conversation.push({ role: 'user', text: userMessage });

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

function appendMessage(sender, text) {
  const msg = document.createElement('div');
  msg.classList.add('message', sender);
  msg.textContent = text;
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


