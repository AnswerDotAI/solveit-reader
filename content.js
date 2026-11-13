function toMarkdown() {
  const td = new TurndownService({headingStyle:'atx', codeBlockStyle:'fenced', bulletListMarker:'-'})
  td.use(turndownPluginGfm.gfm)

  td.remove([
    'script', 'style', 'noscript', 'iframe', 'nav', 'footer', 'aside',
    'button', 'form', 'input', 'select', 'textarea',
    '[role="button"]', '[role="navigation"]', '[role="banner"]', '[role="complementary"]',
    '[aria-hidden="true"]', '.sr-only', '.visually-hidden', '.hidden',
    '[class*="cookie"]', '[class*="popup"]', '[class*="modal"]', '[class*="banner"]',
    '[class*="sidebar"]', '[class*="comment"]', '[class*="share"]', '[class*="social"]',
    '[class*="newsletter"]', '[class*="subscribe"]', '[class*="related"]', '[class*="recommended"]'
  ])

  td.addRule('imgs', {
    filter: 'img',
    replacement: (c,n) => n.src ? `![${n.alt||''}](${n.src}${n.title ? ` "${n.title}"` : ''})` : ''
  })

  const tex = n => n.querySelector('annotation[encoding="application/x-tex"]')?.textContent.trim()
  td.addRule('math', {
    filter: 'math',
    replacement: (c,n) => {
      const t = tex(n)
      if (!t) return c
      return n.getAttribute('display')==='block' ? `$$${t}$$` : `\\(${t}\\)`
    }
  })

  td.addRule('tableCell', {
    filter: ['th', 'td'],
    replacement: (c,n) => (n.cellIndex ? ' ' : '| ') + c.replace(/\s*\n\s*/g, ' ').trim() + ' |'
  })

  const eqnSel = '.ltx_equation, .ltx_equationgroup'
  td.addRule('headlessTables', {
    filter: n => n.nodeName==='TABLE' && n.rows.length && !n.tHead && !n.matches(eqnSel) && ![...n.rows[0].cells].every(c => c.nodeName==='TH'),
    replacement: (c,n) => {
      const [head, ...body] = c.trim().split('\n')
      return '\n\n' + [head, '|' + ' --- |'.repeat(n.rows[0].cells.length), ...body].join('\n') + '\n\n'
    }
  })

  td.addRule('eqnTables', {
    filter: n => n.nodeName==='TABLE' && n.matches(eqnSel),
    replacement: (c,n) => '\n\n' + [...n.querySelectorAll('math')].map(tex).filter(Boolean).map(t => `$$${t}$$`).join('\n\n') + '\n\n'
  })

  td.addRule('links', {
    filter: 'a',
    replacement: (c,n) => n.href ? `[${c}](${n.href}${n.title ? ` "${n.title}"` : ''})` : c
  })

  const sels = ['article', 'main', '[role="main"]', '.content', '#content', '.post', '.entry', '.post-content', '.article-content', '.article-body']
  const largest = els => els.reduce((a,b) => (b.textContent.length > (a?.textContent.length||0) ? b : a), null)
  const content = largest(sels.flatMap(s => [...document.querySelectorAll(s)])) || document.body
  const dom = content.cloneNode(true)
  for (const o of dom.querySelectorAll('object[type^="image/"]')) {
    const img = document.createElement('img')
    img.src = o.data
    o.replaceWith(img)
  }

  const tocSels = ['nav.ltx_TOC', '.toc', '#toc', 'nav[role="doc-toc"]', '.table-of-contents', '#table-of-contents']
  let toc = ''
  for (const s of tocSels) {
    const el = document.querySelector(s)
    if (el?.textContent.length > 50) { toc = td.turndown(el); break }
  }

  const unesc = s => s.replace(/\\\[/g, '[').replace(/\\\]/g, ']')
  let md = unesc(td.turndown(dom))
  if (toc) md = unesc(toc) + '\n\n---\n\n' + md

  return {title:document.title, url:window.location.href, markdown:md}
}

chrome.runtime.onMessage.addListener((req, sender, respond) => {
  if (req.action === 'convertPage') {
    try { respond({success:true, data:toMarkdown()}) }
    catch (e) { respond({success:false, error:e.message}) }
  }
  return true
})
