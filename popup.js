const $      = id => document.getElementById(id)
const status = (msg,typ='') => { $('status').textContent = msg; $('status').className = typ }

async function load() {
  const s = await chrome.storage.sync.get({instance:'', folder:'readings'})
  $('instance').value = s.instance
  $('folder').value = s.folder
}

async function importPage() {
  $('import').disabled = true
  status('Starting...')
  await chrome.storage.sync.set({instance:$('instance').value, folder:$('folder').value})
  const [tab] = await chrome.tabs.query({active:true, currentWindow:true})
  const r = await chrome.runtime.sendMessage({action:'import', tabId:tab.id})
  if (r?.success) return status('✓ Imported!', 'success')
  status(`Error: ${r?.error || 'no response from the background worker'}`, 'error')
  $('import').disabled = false
}

chrome.runtime.onMessage.addListener(m => { if (m.action === 'status') status(m.msg) })
document.addEventListener('DOMContentLoaded', load)
$('import').addEventListener('click', importPage)
