const $ = id => document.getElementById(id);
const sanitize = t => t.toLowerCase().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').substring(0,50);
const hashUrl = url => { 
  let h = 0; 
  for (let i = 0; i < url.length; i++) h = ((h << 5) - h) + url.charCodeAt(i);
  return Math.abs(h).toString(36).substring(0,6);
};

let state = { instance: '', folder: '', cookies: '', dlgName: '', initialized: false };

// Get cookies for instance
async function getCookies(url) {
  return (await chrome.cookies.getAll({url})).map(c => `${c.name}=${c.value}`).join('; ');
}

// Get current tab
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  return tab;
}

// Get page content as markdown via content script
async function getPageMarkdown(tabId) {
  await chrome.scripting.executeScript({
    target: {tabId},
    files: ['turndown.js', 'turndown-plugin-gfm.js']
  });
  const [{result}] = await chrome.scripting.executeScript({
    target: {tabId},
    files: ['content.js']
  });
  return result;
}

// Display a message in the chat
function addChatMessage(role, content) {
  const msg = document.createElement('div');
  msg.className = `message ${role}`;
  msg.textContent = content;
  $('messages').appendChild(msg);
  $('messages').scrollTop = $('messages').scrollHeight;
}

// Show/hide typing indicator
function setTyping(show) {
  $('typing').classList.toggle('show', show);
  $('send').disabled = show;
  if (show) $('messages').scrollTop = $('messages').scrollHeight;
}

// Update status
function setStatus(text) {
  $('status').textContent = text;
}

// Initialize chat for current page
async function initializeChat() {
  try {
    setStatus('Initializing...');
    
    // Load settings
    const settings = await chrome.storage.sync.get({instance: '', folder: 'chats'});
    if (!settings.instance) {
      addChatMessage('error', 'Please configure your Solveit instance URL in the extension popup.');
      return;
    }
    
    state.instance = settings.instance;
    state.folder = settings.folder;
    state.cookies = await getCookies(state.instance);
    
    // Get current tab
    const tab = await getCurrentTab();
    const urlHash = hashUrl(tab.url);
    state.dlgName = `${state.folder}/${sanitize(tab.title)}-${urlHash}`;
    
    // Check if dialog exists
    const exists = await api.dialogExists(state.instance, state.dlgName, state.cookies);
    
    if (exists) {
      // Load existing chat
      setStatus('Loading chat...');
      addChatMessage('system', 'Resuming conversation...');
      await loadChatHistory();
    } else {
      // Create new dialog and import page
      setStatus('Importing page...');
      addChatMessage('system', 'Importing page content...');
      
      await api.createDialog(state.instance, state.dlgName, state.cookies);
      
      // Add page URL as header note
      await api.addMessage(state.instance, state.dlgName, 
        `# ${tab.title}\n\nSource: ${tab.url}`, 'note', state.cookies);
      
      // Get and add page content
      const content = await getPageMarkdown(tab.id);
      await api.addMessage(state.instance, state.dlgName, content, 'note', state.cookies);
      
      addChatMessage('system', 'Page imported! Ask me anything about it.');
    }
    
    state.initialized = true;
    setStatus('Ready');
    
    // Show chat UI
    $('init-screen').classList.add('hidden');
    $('messages').classList.remove('hidden');
    $('input-area').classList.remove('hidden');
    $('input').focus();
    
  } catch (err) {
    console.error('Init error:', err);
    addChatMessage('error', `Error: ${err.message}`);
    setStatus('Error');
  }
}

// Load existing chat history
async function loadChatHistory() {
  try {
    const result = await api.getMessages(state.instance, state.dlgName, state.cookies);
    if (result && result.msgs) {
      for (const msg of result.msgs) {
        if (msg.msg_type === 'prompt') {
          addChatMessage('user', msg.content);
          if (msg.output) addChatMessage('assistant', msg.output);
        }
      }
    }
  } catch (err) {
    console.error('Load history error:', err);
  }
}

// Send a message
async function sendMessage() {
  const input = $('input');
  const text = input.value.trim();
  if (!text || !state.initialized) return;
  
  input.value = '';
  input.style.height = 'auto';
  addChatMessage('user', text);
  setTyping(true);
  setStatus('Thinking...');
  
  try {
    // Add prompt message
    const msgId = await api.addMessage(state.instance, state.dlgName, text, 'prompt', state.cookies);
    
    // Execute and wait for response
    const result = await api.execMessage(state.instance, state.dlgName, msgId, state.cookies);
    
    setTyping(false);
    setStatus('Ready');
    
    if (result.output) {
      addChatMessage('assistant', result.output);
    } else {
      addChatMessage('error', 'No response received');
    }
    
  } catch (err) {
    console.error('Send error:', err);
    setTyping(false);
    setStatus('Error');
    addChatMessage('error', `Error: ${err.message}`);
  }
}

// Auto-resize textarea
function autoResize() {
  const input = $('input');
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  $('init-btn').addEventListener('click', initializeChat);
  $('send').addEventListener('click', sendMessage);
  
  $('input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  $('input').addEventListener('input', autoResize);
});
