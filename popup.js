const $  = id => document.getElementById(id)
const sanitize = t => t.toLowerCase().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').substring(0,60)
const cookies  = async url => (await chrome.cookies.getAll({url})).map(c => `${c.name}=${c.value}`).join('; ')
const status   = (msg,typ='') => { $('status').textContent = msg; $('status').className = typ }

async function load() {
  const s = await chrome.storage.sync.get({instance:'', folder:'readings'})
  $('instance').value = s.instance
  $('folder').value = s.folder
  
  // Add chat button handler
  $('chat').addEventListener('click', async () => {
    await save()
    chrome.sidePanel.open({windowId: (await chrome.windows.getCurrent()).id})
    window.close()
  })
}

async function save() {
  await chrome.storage.sync.set({instance:$('instance').value, folder:$('folder').value})
}

async function post(url, body, ck) {
  const hdrs = {'Content-Type':'application/x-www-form-urlencoded', 'Cookie':ck}
  return fetch(url, {method:'POST', headers:hdrs, body, credentials:'include'})
}

async function importPage() {
  $('import').disabled = true
  status('Converting page...')

  try {
    await save()
    const [tab] = await chrome.tabs.query({active:true, currentWindow:true})
    await chrome.scripting.executeScript({target:{tabId:tab.id},
                                          files:['turndown.js','turndown-plugin-gfm.js','content.js']})

    status('Extracting content...')
    const r = await chrome.tabs.sendMessage(tab.id, {action:'convertPage'})
    if (!r.success) throw new Error(r.error || 'Failed to convert page')

    const {title, url, markdown:md} = r.data
    const inst = $('instance').value.replace(/\/$/,'')
    const folder = $('folder').value.replace(/^\/|\/$/g,'')
    const dlgName = `${folder}/${sanitize(title || 'untitled')}`
    const ck = await cookies(inst)

    status('Creating dialog...')
    const cr = await post(`${inst}/create_dialog_`, `name=${encodeURIComponent(dlgName)}`, ck)
    if (!cr.ok) throw new Error(`Failed to create dialog: ${cr.status}`)

    const addNote = (content) => post(`${inst}/add_relative_`,
                                      new URLSearchParams({dlg_name:dlgName, content,
                                                           msg_type:'note', placement:'at_end'}), ck)
    await addNote(`Source: ${url}`)
    const ar = await addNote(md)
    if (!ar.ok) throw new Error(`Failed to add content: ${ar.status}`)

    chrome.tabs.create({url:`${inst}/dialog_?name=${dlgName.replace(/\//g,'%2F')}`})
    status('✓ Imported!', 'success')

  } catch (err) {
    status(`Error: ${err.message}`, 'error')
    $('import').disabled = false
  }
}

document.addEventListener('DOMContentLoaded', load)
$('import').addEventListener('click', importPage)