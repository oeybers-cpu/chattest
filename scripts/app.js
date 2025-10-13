// Utility Functions
function escapeHTML(str) {
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));
}

function processInline(text) {
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
  return text;
}

function markdownToHTML(markdown) {
  let html = '';
  let inList = false;

  const lines = markdown.split('\n');
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    if (inList && !line.startsWith('- ')) {
      html += '</ul>';
      inList = false;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const text = processInline(headingMatch[2]);
      html += `<strong class="section-title">${text}</strong>`;
      continue;
    }

    if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
      const text = processInline(line.substring(2, line.length - 2));
      html += `<strong class="section-title">${text}</strong>`;
      continue;
    }

    if (line.startsWith('- ')) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      const text = processInline(line.substring(2));
      html += `<li>${text}</li>`;
      continue;
    }

    if (line.startsWith('>')) {
      let blockquoteContent = processInline(line.substring(1).trim());
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith('>')) {
        i++;
        blockquoteContent += ' ' + processInline(lines[i].trim().substring(1).trim());
      }
      html += `<div class="card__quote"><p>${blockquoteContent}</p></div>`;
      continue;
    }

    if (line === '') {
      continue;
    }

    const text = processInline(line);
    html += `<p>${text}</p>`;
  }

  if (inList) {
    html += '</ul>';
  }

  return html;
}

function getCurrentTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function showTypingIndicator() {
  const out = document.getElementById("out");
  out.innerHTML += `
    <div class="card bot typing-indicator">
      <div class="card__title">ALLChat</div>
      <div class="message-content">
        <span class="typing-dots">
          <span>.</span><span>.</span><span>.</span>
        </span>
      </div>
    </div>`;
  smoothScrollToBottom();
}

function hideTypingIndicator() {
  const indicator = document.querySelector('.typing-indicator');
  if (indicator) indicator.remove();
}

function smoothScrollToBottom() {
  const container = document.querySelector('.chat-container');
  container.scrollTo({
    top: container.scrollHeight,
    behavior: 'smooth'
  });
}

function addCopyButton(messageElement) {
  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-btn';
  copyBtn.innerHTML = '📋';
  copyBtn.title = 'Copy text';
  copyBtn.style.background = 'none';
  copyBtn.style.border = 'none';
  copyBtn.style.color = 'var(--light)';
  copyBtn.style.cursor = 'pointer';
  copyBtn.style.opacity = '0.7';
  copyBtn.style.marginLeft = '10px';
  copyBtn.style.fontSize = '0.8rem';
  
  copyBtn.addEventListener('click', function() {
    const text = messageElement.querySelector('.message-content').textContent;
    navigator.clipboard.writeText(text).then(() => {
      const originalHTML = this.innerHTML;
      this.innerHTML = '✓';
      this.style.opacity = '1';
      setTimeout(() => {
        this.innerHTML = originalHTML;
        this.style.opacity = '0.7';
      }, 2000);
    });
  });
  
  messageElement.querySelector('.card__title').appendChild(copyBtn);
}

function showQuickActions() {
  const quickActions = [
    "Explain academic literacy",
    "What are the key literacy models?",
    "How to improve reading comprehension?",
    "What is critical literacy?"
  ];

  const out = document.getElementById("out");
  const quickActionsHTML = `
    <div class="quick-actions">
      <p style="text-align: center; color: var(--text-gray); margin: 1rem 0 0.5rem 0; font-size: 0.9rem;">Quick questions:</p>
      <div class="quick-actions-buttons">
        ${quickActions.map(action => 
          `<button class="quick-action-btn" data-question="${action}">${action}</button>`
        ).join('')}
      </div>
    </div>`;
  out.innerHTML += quickActionsHTML;

  // Add event listeners to quick action buttons
  document.querySelectorAll('.quick-action-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const input = document.getElementById("input");
      input.value = this.getAttribute('data-question');
      input.focus();
    });
  });
}

function updateOnlineStatus() {
  const status = navigator.onLine ? 'online' : 'offline';
  document.body.setAttribute('data-status', status);
}

// Session Management
let messageCount = 0;

function updateStats() {
  messageCount++;
  console.log(`Session: ${messageCount} messages exchanged`);
}

function saveConversation() {
  const out = document.getElementById("out");
  const conversation = {
    html: out.innerHTML,
    timestamp: new Date().toISOString(),
    messageCount: messageCount
  };
  localStorage.setItem('allchat_conversation', JSON.stringify(conversation));
}

function loadConversation() {
  const saved = localStorage.getItem('allchat_conversation');
  if (saved) {
    const conversation = JSON.parse(saved);
    const out = document.getElementById("out");
    out.innerHTML = conversation.html;
    
    // Reattach copy buttons to loaded messages
    document.querySelectorAll('.card.bot').forEach(card => {
      if (!card.querySelector('.copy-btn')) {
        addCopyButton(card);
      }
    });
    
    smoothScrollToBottom();
  }
}

function clearConversation() {
  if (confirm('Clear conversation history?')) {
    const out = document.getElementById("out");
    out.innerHTML = '';
    localStorage.removeItem('allchat_conversation');
    messageCount = 0;
  }
}

// PDF Generation Function
function generatePDF() {
  const chatContainer = document.querySelector('.chat-container');
  if (!chatContainer) return;
  
  // Create a clean container for PDF generation
  const pdfContainer = document.createElement('div');
  pdfContainer.style.padding = '20px';
  pdfContainer.style.fontFamily = 'Arial, sans-serif';
  pdfContainer.style.fontSize = '12px';
  pdfContainer.style.lineHeight = '1.4';
  pdfContainer.style.color = '#000000';
  pdfContainer.style.backgroundColor = '#ffffff';
  
  // Add a professional header
  const header = document.createElement('div');
  header.style.borderBottom = '2px solid #4361ee';
  header.style.paddingBottom = '15px';
  header.style.marginBottom = '20px';
  header.innerHTML = `
    <h1 style="color: #4361ee; font-family: 'Ubuntu', sans-serif; margin: 0 0 5px 0; font-size: 24px;">ALLChat Conversation</h1>
    <p style="color: #666; margin: 0 0 10px 0; font-size: 14px;">Academic Literacy Assistant - Generated on ${new Date().toLocaleDateString()}</p>
  `;
  pdfContainer.appendChild(header);
  
  // Clone and style the chat messages
  const messages = chatContainer.querySelectorAll('.card');
  messages.forEach((message, index) => {
    const clone = message.cloneNode(true);
    
    // Remove copy buttons from PDF
    const copyBtns = clone.querySelectorAll('.copy-btn');
    copyBtns.forEach(btn => btn.remove());
    
    // Remove typing indicators
    if (clone.classList.contains('typing-indicator')) {
      return; // Skip typing indicators
    }
    
    // Apply PDF-specific styling
    clone.style.backgroundColor = '#ffffff';
    clone.style.border = '1px solid #e0e0e0';
    clone.style.borderRadius = '8px';
    clone.style.padding = '15px';
    clone.style.marginBottom = '15px';
    clone.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    clone.style.pageBreakInside = 'avoid';
    
    // Style user messages differently
    if (clone.classList.contains('user')) {
      clone.style.borderLeft = '4px solid #4361ee';
      clone.style.backgroundColor = '#f8f9ff';
    } else if (clone.classList.contains('bot')) {
      clone.style.borderLeft = '4px solid #7209b7';
      clone.style.backgroundColor = '#faf8ff';
    }
    
    // Style titles
    const title = clone.querySelector('.card__title');
    if (title) {
      title.style.color = clone.classList.contains('user') ? '#4361ee' : '#7209b7';
      title.style.fontWeight = 'bold';
      title.style.marginBottom = '10px';
      title.style.fontSize = '14px';
    }
    
    // Style content
    const content = clone.querySelector('.message-content');
    if (content) {
      content.style.color = '#333333';
      content.style.fontSize = '12px';
      content.style.lineHeight = '1.5';
    }
    
    // Style section titles
    const sectionTitles = clone.querySelectorAll('.section-title');
    sectionTitles.forEach(section => {
      section.style.color = '#333333';
      section.style.borderBottom = '1px solid #e0e0e0';
      section.style.paddingBottom = '5px';
      section.style.marginBottom = '10px';
      section.style.fontSize = '13px';
    });
    
    // Style paragraphs
    const paragraphs = clone.querySelectorAll('p');
    paragraphs.forEach(p => {
      p.style.marginBottom = '10px';
      p.style.color = '#333333';
    });
    
    // Style lists
    const lists = clone.querySelectorAll('ul');
    lists.forEach(ul => {
      ul.style.paddingLeft = '20px';
      ul.style.marginBottom = '10px';
      ul.style.listStyleType = 'disc';
    });
    
    const listItems = clone.querySelectorAll('li');
    listItems.forEach(li => {
      li.style.paddingLeft = '0';
      li.style.marginBottom = '5px';
      li.style.color = '#333333';
      li.style.listStyleType = 'disc';
    });
    
    // Style blockquotes
    const blockquotes = clone.querySelectorAll('.card__quote');
    blockquotes.forEach(blockquote => {
      blockquote.style.borderLeft = '3px solid #4361ee';
      blockquote.style.padding = '10px 15px';
      blockquote.style.margin = '10px 0';
      blockquote.style.backgroundColor = '#f8f9fa';
      blockquote.style.borderRadius = '0 4px 4px 0';
      blockquote.style.fontStyle = 'italic';
      blockquote.style.color = '#555555';
    });
    
    // Style code elements
    const codeElements = clone.querySelectorAll('code');
    codeElements.forEach(code => {
      code.style.backgroundColor = '#f5f5f5';
      code.style.padding = '2px 4px';
      code.style.borderRadius = '3px';
      code.style.border = '1px solid #ddd';
      code.style.fontFamily = 'Monaco, Consolas, monospace';
      code.style.fontSize = '11px';
      code.style.color = '#333333';
    });
    
    pdfContainer.appendChild(clone);
    
    // Add page break after every 5 messages to avoid overcrowding
    if ((index + 1) % 5 === 0 && index !== messages.length - 1) {
      const pageBreak = document.createElement('div');
      pageBreak.style.pageBreakAfter = 'always';
      pdfContainer.appendChild(pageBreak);
    }
  });
  
  // Add a professional footer
  const footer = document.createElement('div');
  footer.style.borderTop = '1px solid #e0e0e0';
  footer.style.paddingTop = '15px';
  footer.style.marginTop = '20px';
  footer.style.color = '#666';
  footer.style.fontSize = '10px';
  footer.innerHTML = `
    <p style="margin: 0;">Generated by ALLChat - Academic Literacy Assistant</p>
    <p style="margin: 5px 0 0 0;">Designed by Dr Oscar Eybers © 2025</p>
  `;
  pdfContainer.appendChild(footer);
  
  // PDF generation options
  const opt = {
    margin: [0.5, 0.5, 0.5, 0.5],
    filename: `allchat-conversation-${new Date().toISOString().split('T')[0]}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2, 
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    },
    jsPDF: { 
      unit: 'in', 
      format: 'a4', 
      orientation: 'portrait',
      compress: true
    },
    pagebreak: { mode: 'avoid-all', before: '.page-break' }
  };
  
  // Generate and download PDF
  html2pdf().set(opt).from(pdfContainer).save();
}

// Main Chat Functionality
async function sendMessage() {
  const input = document.getElementById("input");
  const out = document.getElementById("out");
  const content = input.value.trim();
  
  if (!content) return;
  
  const escapedUser = escapeHTML(content);
  out.innerHTML += `
    <div class="card user">
      <div class="card__title">You <span class="timestamp">${getCurrentTime()}</span></div>
      <div class="message-content">${escapedUser}</div>
    </div>`;
  
  input.value = '';
  updateCharCounter();
  hideQuickActions();
  showTypingIndicator();
  updateStats();
  
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content }] })
    });
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content || "No response from server";
    
    hideTypingIndicator();
    
    const htmlResponse = markdownToHTML(reply);
    const botMessageHTML = `
      <div class="card bot">
        <div class="card__title">ALLChat <span class="timestamp">${getCurrentTime()}</span></div>
        <div class="message-content">${htmlResponse}</div>
      </div>`;
    
    out.innerHTML += botMessageHTML;
    
    // Add copy button to the new bot message
    const newBotMessage = out.querySelector('.card.bot:last-of-type');
    addCopyButton(newBotMessage);
    
    // Show quick actions after first bot response
    if (messageCount === 1) {
      showQuickActions();
    }
    
    saveConversation();
    
  } catch (e) {
    hideTypingIndicator();
    const escapedError = escapeHTML(e.message);
    out.innerHTML += `
      <div class="card error">
        <div class="card__title">Error</div>
        <div class="message-content">${escapedError}</div>
      </div>`;
  }
  
  smoothScrollToBottom();
}

// Character Counter Functionality
function updateCharCounter() {
  const input = document.getElementById("input");
  const charCount = input.value.length;
  let counter = document.getElementById('char-counter');
  
  if (!counter) {
    counter = document.createElement('div');
    counter.id = 'char-counter';
    counter.style.fontSize = '0.8rem';
    counter.style.marginTop = '0.5rem';
    counter.style.textAlign = 'right';
    input.parentNode.appendChild(counter);
  }
  
  counter.textContent = `${charCount}/500`;
  counter.style.color = charCount > 400 ? '#ff6b6b' : '#adb5bd';
}

function hideQuickActions() {
  const quickActions = document.querySelector('.quick-actions');
  if (quickActions) {
    quickActions.style.display = 'none';
  }
}

// Auto-save Draft
let draftTimer;
function setupAutoSave() {
  const input = document.getElementById("input");
  
  input.addEventListener('input', function() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      localStorage.setItem('chatDraft', this.value);
    }, 2000);
    updateCharCounter();
  });
}

function loadDraft() {
  const input = document.getElementById("input");
  const draft = localStorage.getItem('chatDraft');
  if (draft) {
    input.value = draft;
    updateCharCounter();
  }
}

// Initialize the application
function init() {
  const input = document.getElementById("input");
  const sendButton = document.getElementById("send");
  const downloadPDFButton = document.getElementById("download-pdf");
  
  // Load saved data
  loadDraft();
  loadConversation();
  
  // Set up event listeners
  sendButton.addEventListener("click", sendMessage);
  downloadPDFButton.addEventListener('click', generatePDF);
  
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });
  
  setupAutoSave();
  
  // Online/offline detection
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();
  
  // Add clear conversation button
  const clearBtn = document.createElement('button');
  clearBtn.className = 'eyers-link';
  clearBtn.textContent = 'Clear';
  clearBtn.style.marginLeft = '0.5rem';
  clearBtn.addEventListener('click', clearConversation);
  document.querySelector('.mobile-button-row').appendChild(clearBtn);
  
  console.log('ALLChat initialized successfully');
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
```

And here's the additional CSS needed for the new features:

```css
/* Typing indicator */
.typing-indicator {
  opacity: 0.7;
}

.typing-dots span {
  animation: typing 1.4s infinite;
  opacity: 0.3;
}

.typing-dots span:nth-child(2) { 
  animation-delay: 0.2s; 
}

.typing-dots span:nth-child(3) { 
  animation-delay: 0.4s; 
}

@keyframes typing {
  0%, 60%, 100% { 
    opacity: 0.3; 
  }
  30% { 
    opacity: 1; 
  }
}

/* Quick actions */
.quick-actions {
  margin: 1rem 0;
  padding: 1rem;
  background: var(--card-bg);
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);
}

.quick-actions-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}

.quick-action-btn {
  background: rgba(58, 134, 255, 0.1);
  border: 1px solid rgba(58, 134, 255, 0.3);
  color: var(--light);
  padding: 0.5rem 1rem;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.quick-action-btn:hover {
  background: rgba(58, 134, 255, 0.2);
  transform: translateY(-1px);
}

/* Timestamp */
.timestamp {
  font-size: 0.7rem;
  color: var(--text-gray);
  margin-left: 10px;
  font-weight: normal;
}

/* Copy button */
.copy-btn {
  transition: all 0.3s ease;
}

.copy-btn:hover {
  opacity: 1 !important;
  transform: scale(1.1);
}

/* Offline indicator */
body[data-status="offline"]::before {
  content: "Offline - Some features limited";
  position: fixed;
  top: 10px;
  right: 10px;
  background: #ff6b6b;
  color: white;
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 0.8rem;
  z-index: 1000;
}

/* Character counter */
#char-counter {
  transition: color 0.3s ease;
}

/* Mobile responsiveness for new features */
@media (max-width: 768px) {
  .quick-actions-buttons {
    flex-direction: column;
    align-items: center;
  }
  
  .quick-action-btn {
    width: 100%;
    max-width: 300px;
    text-align: center;
  }
  
  .mobile-button-row {
    display: flex;
    gap: 0.5rem;
  }
  
  .mobile-button-row button {
    flex: 1;
  }
}
