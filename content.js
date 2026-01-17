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
    replacement: (c,n) => n.src ? `![${n.alt||''}](${n.src}#ai${n.title ? ` "${n.title}"` : ''})` : ''
  })

  td.addRule('math', {
    filter: 'math',
    replacement: (c,n) => {
      const a = n.querySelector('annotation[encoding="application/x-tex"]')
      if (!a) return c
      const tex = a.textContent.trim()
      return n.getAttribute('display')==='block' ? `$$${tex}$$` : `\\(${tex}\\)`
    }
  })

  td.addRule('links', {
    filter: 'a',
    replacement: (c,n) => n.href ? `[${c}](${n.href}${n.title ? ` "${n.title}"` : ''})` : c
  })

  const sels = ['article', 'main', '[role="main"]', '.content', '#content', '.post', '.entry', '.post-content', '.article-content', '.article-body']
  const largest = els => els.reduce((a,b) => (b.textContent.length > (a?.textContent.length||0) ? b : a), null)
  const content = largest(sels.flatMap(s => [...document.querySelectorAll(s)])) || document.body

  const tocSels = ['nav.ltx_TOC', '.toc', '#toc', 'nav[role="doc-toc"]', '.table-of-contents', '#table-of-contents']
  let toc = ''
  for (const s of tocSels) {
    const el = document.querySelector(s)
    if (el?.textContent.length > 50) { toc = td.turndown(el); break }
  }

  const unesc = s => s.replace(/\\\[/g, '[').replace(/\\\]/g, ']')
  let md = unesc(td.turndown(content))
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
