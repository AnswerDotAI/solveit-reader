const sanitize = t => t.toLowerCase().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').substring(0,60)
const cellId   = () => [...crypto.getRandomValues(new Uint8Array(4))].map(b => b.toString(16).padStart(2,'0')).join('')
const note     = source => ({cell_type:'markdown', id:cellId(), metadata:{}, source})
const notebook = (...notes) => ({cells:notes.map(note), metadata:{solveit:{ver:2}}, nbformat:4, nbformat_minor:5})
const fail     = (r, what) => { throw new Error(r.status===403 ? 'Not signed in to Solveit' : `${what} (${r.status})`) }

async function convertTab(tabId) {
  await chrome.scripting.executeScript({target:{tabId}, files:['turndown.js','turndown-plugin-gfm.js','content.js']})
  const r = await chrome.tabs.sendMessage(tabId, {action:'convertPage'})
  if (!r?.success) throw new Error(r?.error || 'Failed to convert page')
  return r.data
}

async function exists(inst, name) {
  const r = await fetch(`${inst}/static/${name}`, {credentials:'include'})
  if (r.status===404) return false
  if (!r.ok) fail(r, 'Could not check dialog name')
  return true
}

async function freeName(inst, folder, base) {
  for (let i=1; i<100; i++) {
    const name = `${folder ? folder+'/' : ''}${base}${i>1 ? '-'+i : ''}.ipynb`
    if (!await exists(inst, name)) return name
  }
  throw new Error(`Too many dialogs named ${base}`)
}

async function upload(inst, name, nb) {
  const i = name.lastIndexOf('/')
  const body = new FormData()
  body.append('folder', i<0 ? '' : name.slice(0,i))
  body.append('files', new Blob([JSON.stringify(nb)], {type:'application/x-ipynb+json'}), name.slice(i+1))
  const r = await fetch(`${inst}/upload_file_`, {method:'POST', body, credentials:'include'})
  if (!r.ok) fail(r, 'Upload failed')
}

async function importTab(tabId, {instance, folder}, onStatus = () => {}) {
  const inst = instance.replace(/\/$/,'')
  if (!inst) throw new Error('Set the Solveit instance URL first')
  onStatus('Converting page...')
  const {title, url, markdown} = await convertTab(tabId)
  onStatus('Creating dialog...')
  const name = await freeName(inst, folder.replace(/^\/|\/$/g,''), sanitize(title) || 'untitled')
  await upload(inst, name, notebook(`Source: ${url}`, markdown))
  const dlg = `${inst}/dialog_?name=${encodeURIComponent(name)}`
  await chrome.tabs.create({url:dlg})
  return {name, url:dlg}
}

chrome.runtime.onMessage.addListener((req, sender, respond) => {
  if (req.action !== 'import') return
  const onStatus = msg => chrome.runtime.sendMessage({action:'status', msg}).catch(() => {})
  chrome.storage.sync.get({instance:'', folder:'readings'})
    .then(s => importTab(req.tabId, s, onStatus))
    .then(r => respond({success:true, ...r}), e => respond({success:false, error:e.message}))
  return true
})
