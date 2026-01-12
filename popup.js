// Sanitize title for use as dialog name
function sanitizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 60);
}

// Get cookies for a URL
async function getCookies(url) {
  const cookies = await chrome.cookies.getAll({ url });
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

// Load saved settings
async function loadSettings() {
  const settings = await chrome.storage.sync.get({
    instance: 'http://localhost:6001',
    folder: 'readings'
  });
  document.getElementById('instance').value = settings.instance;
  document.getElementById('folder').value = settings.folder;
}

// Save settings
async function saveSettings() {
  await chrome.storage.sync.set({
    instance: document.getElementById('instance').value,
    folder: document.getElementById('folder').value
  });
}

// Set status message
function setStatus(msg, type = '') {
  const status = document.getElementById('status');
  status.textContent = msg;
  status.className = type;
}

// Main import function
async function importPage() {
  const btn = document.getElementById('import');
  btn.disabled = true;
  setStatus('Importing...');
  
  try {
    // Save settings for next time
    await saveSettings();
    
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const pageUrl = tab.url;
    const pageTitle = tab.title || 'untitled';
    
    const instance = document.getElementById('instance').value.replace(/\/$/, '');
    const folder = document.getElementById('folder').value.replace(/^\/|\/$/g, '');
    const dialogName = `${folder}/${sanitizeTitle(pageTitle)}`;
    
    // Get cookies for auth
    const cookies = await getCookies(instance);
    
    // Create dialog
    const createResp = await fetch(`${instance}/create_dialog_`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies
      },
      body: `name=${encodeURIComponent(dialogName)}`,
      credentials: 'include'
    });
    
    if (!createResp.ok) throw new Error(`Failed to create dialog: ${createResp.status}`);
    
    // Add code cell that will fetch and add the URL content
    const codeContent = `from dialoghelper.core import url2note\n\nurl2note('${pageUrl}')`;
    
    const addResp = await fetch(`${instance}/add_relative_`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies
      },
      body: new URLSearchParams({
        dlg_name: dialogName,
        content: codeContent,
        msg_type: 'code',
        placement: 'at_end'
      }),
      credentials: 'include'
    });
    
    if (!addResp.ok) throw new Error(`Failed to add message: ${addResp.status}`);
    
    // Get the message ID from response and queue it to run
    const msgId = await addResp.text();
    
    await fetch(`${instance}/add_runq_`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies
      },
      body: new URLSearchParams({
        dlg_name: dialogName,
        ids: msgId,
        api: 'true'
      }),
      credentials: 'include'
    });
    
    // Open the dialog in a new tab
    const dialogPath = dialogName.replace(/\//g, '%2F');
    chrome.tabs.create({ url: `${instance}/dialog_?name=${dialogPath}` });
    
    setStatus('✓ Imported! Opening dialog...', 'success');
    
  } catch (err) {
    setStatus(`Error: ${err.message}`, 'error');
    btn.disabled = false;
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', loadSettings);
document.getElementById('import').addEventListener('click', importPage);
