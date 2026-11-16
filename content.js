// Markdown tables have no spans: rebuild every row at full width, with an empty cell wherever a colspan or rowspan covered one
function unspan(table) {
  const rows = [...table.rows], grid = rows.map(() => [])
  rows.forEach((row, i) => {
    let col = 0
    for (const cell of [...row.cells]) {
      while (grid[i][col]) col++
      const cs = Math.max(cell.colSpan, 1), rs = Math.min(cell.rowSpan || rows.length, rows.length-i)
      for (let r=0; r<rs; r++) for (let c=0; c<cs; c++) grid[i+r][col+c] = r||c ? cell.nodeName : cell
      cell.colSpan = cell.rowSpan = 1
      col += cs
    }
  })
  const width = Math.max(...grid.map(g => g.length))
  rows.forEach((row, i) => row.replaceChildren(...Array.from({length:width},
    (_, c) => typeof grid[i][c]==='object' ? grid[i][c] : document.createElement(grid[i][c] || 'td'))))
}

function toMarkdown() {
  const td = new TurndownService({headingStyle:'atx', codeBlockStyle:'fenced', bulletListMarker:'-'})
  td.use(turndownPluginGfm.gfm)
  // Escaped brackets in text become \[ and \], which Solveit renders as display maths
  td.escape = s => TurndownService.prototype.escape.call(td, s).replace(/\\([[\]])/g, '$1')

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

  // LaTeXML (arXiv) puts the TeX in an annotation; Wikipedia puts it in the data-mw JSON
  const mwTex = n => { try { return JSON.parse(n.getAttribute('data-mw')).body.extsrc.trim() } catch { return '' } }
  const tex = n => n.querySelector('annotation[encoding="application/x-tex"]')?.textContent.trim() || mwTex(n)
  td.addRule('math', {
    filter: 'math',
    replacement: (c,n) => {
      let t = tex(n)
      if (!t) return c
      // A bare | ends a markdown table cell, so maths in a table writes | as \vert and \| as \Vert
      if (n.closest('td, th')) t = t.replace(/\\[\s\S]|\|/g, m => m==='|' ? '\\vert ' : m==='\\|' ? '\\Vert ' : m)
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
  for (const t of dom.querySelectorAll('table')) if (!t.matches(eqnSel)) unspan(t)

  const tocSels = ['nav.ltx_TOC', '.toc', '#toc', 'nav[role="doc-toc"]', '.table-of-contents', '#table-of-contents']
  let toc = ''
  for (const s of tocSels) {
    const el = document.querySelector(s)
    if (el?.textContent.length > 50) { toc = td.turndown(el); break }
  }

  let md = td.turndown(dom)
  if (toc) md = toc + '\n\n---\n\n' + md

  return {title:document.title, url:window.location.href, markdown:md}
}

chrome.runtime.onMessage.addListener((req, sender, respond) => {
  if (req.action === 'convertPage') {
    try { respond({success:true, data:toMarkdown()}) }
    catch (e) { respond({success:false, error:e.message}) }
  }
  return true
})
