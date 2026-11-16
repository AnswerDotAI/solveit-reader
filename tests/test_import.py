"""Import a served article through the extension in a headless Chrome, into an isolated Solveit instance.

Needs `solveit` on PATH and a Chrome build that accepts `--load-extension` (Chrome for Testing or Chromium; `FASTCDP_CHROME` overrides the default Playwright Chromium). Run with `pytest -q`."""
import asyncio, json, os, socket, subprocess, time, httpx, pytest
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
from fastcdp import CDP

EXT = Path(__file__).parent.parent
CHROME = os.environ.get('FASTCDP_CHROME') or sorted((Path.home()/'.cache/ms-playwright').glob('chromium-*/chrome-linux64/chrome'))[-1]

ARTICLE = r'''<!DOCTYPE html><html><head><meta charset="utf-8"><title>Why Cats Purr: A Study</title></head><body>
<nav><a href="/">Home</a> <a href="/about">About</a></nav>
<article>
<h1>Why Cats Purr</h1>
<p>Purring is a <a href="https://example.com/vibration">vibration</a> of the larynx.</p>
<h2>Frequencies</h2>
<table><tr><th>Species</th><th>Hz</th></tr><tr><td>Domestic cat</td><td>25</td></tr></table>
<p>The energy is <math><semantics><mrow><mi>E</mi></mrow><annotation encoding="application/x-tex">E = mc^2</annotation></semantics></math> at rest.</p>
<img src="/cat.png" alt="A cat">
<figure id="S4.F1" class="ltx_figure"><object type="image/svg+xml" data="/loading.svg" id="S4.F1.g1" class="ltx_graphics" width="476" height="85"></object><figcaption class="ltx_caption"><span class="ltx_tag ltx_tag_figure">Figure 1: </span>Model loading.</figcaption></figure>
<table class="ltx_equation ltx_eqn_table" id="S2.Ex1"><tr><td class="ltx_eqn_cell"><math id="S2.Ex1.m1" display="block" alttext="a \oplus b"><semantics><mrow><mi>a</mi></mrow><annotation encoding="application/x-tex">a \oplus b</annotation></semantics></math></td></tr></table>
<table class="ltx_tabular"><tr><td class="ltx_td ltx_th">Model</td><td class="ltx_td ltx_th">Params</td></tr><tr><td>GPT-4o <cite class="ltx_cite"><a href="#bib1">OpenAI (2024)</a></cite></td><td>&gt;100B</td></tr></table>
<p>Wikipedia keeps the TeX in data-mw: <math class="mwe-math-element mwe-math-element-inline" data-mw='{"name":"math","attrs":{},"body":{"extsrc":"(0, 1)"}}'><mrow><mo>(</mo><mn>0</mn><mo>,</mo><mn>1</mn><mo>)</mo></mrow></math> [citation needed].</p>
<math class="mwe-math-element mwe-math-element-block" display="block" data-mw='{"name":"math","attrs":{"display":"block"},"body":{"extsrc":"\n \\sigma(z)_i = \\frac{e^{z_i}}{\\sum_j e^{z_j}}\n"}}'><mrow><mi>σ</mi></mrow></math>
<p><math display="block"><semantics><mrow><mi>a</mi></mrow><annotation encoding="application/x-tex">a \\[2pt] b</annotation></semantics></math></p>
<table class="ltx_tabular"><tr><td class="ltx_th" rowspan="2">Model</td><td class="ltx_th" colspan="2">BLEU</td></tr><tr><td class="ltx_th">EN-DE</td><td class="ltx_th">EN-FR</td></tr><tr><td>Base</td><td>27.3</td><td><math><semantics><mrow><mi>x</mi></mrow><annotation encoding="application/x-tex">|x|_2 + \|y\|</annotation></semantics></math></td></tr></table>
</article>
<footer>Copyright</footer>
</body></html>'''

def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]

@pytest.fixture(scope='session')
def article():
    "URL of the sample article, served from a temp dir"
    with TemporaryDirectory() as d:
        (Path(d)/'article.html').write_text(ARTICLE)
        srv = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=d))
        Thread(target=srv.serve_forever, daemon=True).start()
        try: yield f'http://127.0.0.1:{srv.server_port}/article.html'
        finally: srv.shutdown()

@pytest.fixture(scope='session')
def solveit():
    "(url, root) of an isolated Solveit with its own temp root and gateway"
    with TemporaryDirectory(prefix='solveit-reader-test-') as root:
        port = free_port()
        url = f'http://127.0.0.1:{port}'
        env = os.environ | dict(IN_TEST='true', SOLVEIT_TEST_DATA=root, SOLVELP_URL=os.environ.get('SOLVELP_URL', 'http://127.0.0.1:5002'))
        proc = subprocess.Popen(['solveit', '--host', '127.0.0.1', '--port', str(port), '--reload', 'false'], env=env, cwd=root)
        try:
            for _ in range(150):
                try:
                    httpx.get(url, timeout=1).raise_for_status()
                    break
                except httpx.HTTPError: time.sleep(0.2)
            else: raise RuntimeError(f'solveit on {url} did not answer within 30s')
            yield url, Path(root)
        finally:
            proc.terminate()
            proc.wait(timeout=30)

@pytest.fixture(scope='session')
async def cdp():
    "Headless Chrome on a temp profile with the extension loaded"
    with TemporaryDirectory(prefix='solveit-reader-chrome-') as d:
        wrapper = Path(d)/'chrome'
        wrapper.write_text(f'#!/bin/sh\nexec "{CHROME}" --load-extension="{EXT}" "$@"\n')
        wrapper.chmod(0o755)
        c = await CDP.launch(user_data_dir=Path(d)/'profile', headless=True, chrome=wrapper)
        try: yield c
        finally: await c.quit()

async def worker(cdp, timeout=10):
    "The extension's service worker: (extension id, session id)"
    deadline = time.time()+timeout
    while time.time() < deadline:
        ts = await cdp.target.getTargets()
        if w := next((t for t in ts if t['type']=='service_worker' and t['url'].endswith('/background.js')), None):
            return w['url'].split('/')[2], await cdp.attach(w['targetId'])
        await asyncio.sleep(0.1)
    raise TimeoutError('extension service worker not found')

async def test_import(cdp, solveit, article):
    inst, root = solveit
    page = await cdp.new_page()
    await page.goto(article)
    ext_id, sid = await worker(cdp)
    settings = dict(instance=inst, folder='readings')
    run = f'''(async () => {{
        const [tab] = await chrome.tabs.query({{url: {json.dumps(article)}}})
        return importTab(tab.id, {json.dumps(settings)})
    }})()'''
    existing = await cdp.pages
    r = await cdp.eval(run, sid=sid)
    assert r['name'] == 'readings/why-cats-purr-a-study.ipynb'

    nb = json.loads((root/r['name']).read_text())
    assert [c['cell_type'] for c in nb['cells']] == ['markdown', 'markdown']
    src, md = [''.join(c['source']) for c in nb['cells']]
    assert src == f'Source: {article}'
    assert '# Why Cats Purr' in md
    assert '[vibration](https://example.com/vibration)' in md
    assert '| Species |' in md
    assert r'\(E = mc^2\)' in md
    assert '![A cat](' + article.replace('article.html', 'cat.png') + ')' in md
    assert '![](' + article.replace('article.html', 'loading.svg') + ')' in md
    assert r'$$a \oplus b$$' in md
    assert '<math' not in md
    assert '| Model | Params |' in md
    assert '| --- | --- |' in md
    assert '<cite' not in md
    assert 'OpenAI (2024)](' in md
    assert 'About' not in md and 'Copyright' not in md
    # Wikipedia: TeX from data-mw, inline and display
    assert r'\((0, 1)\)' in md
    assert r'$$\sigma(z)_i = \frac{e^{z_i}}{\sum_j e^{z_j}}$$' in md
    # Brackets: text brackets stay unescaped, TeX brackets keep their backslashes
    assert '[citation needed]' in md and r'\[citation' not in md
    assert r'$$a \\[2pt] b$$' in md
    # Spanned header cells become empty cells, and | inside table maths becomes \vert or \Vert
    assert '| Model | BLEU |  |\n| --- | --- | --- |\n|  | EN-DE | EN-FR |\n' in md
    assert r'| Base | 27.3 | \(\vert x\vert _2 + \Vert y\Vert \) |' in md

    dlg = await cdp.wait_for_new_page(existing)
    await dlg.wait_for("document.querySelector('#dialog-container')?.textContent.includes('Why Cats Purr')", timeout=30)
    assert 'why-cats-purr-a-study' in await dlg.eval('location.href')
    # Every formula reaches Solveit as maths, including the one inside the spanned table's cell
    assert await dlg.eval("document.querySelectorAll('#dialog-container :is(span, div).math').length") == 6
    assert await dlg.eval("document.querySelectorAll('#dialog-container td .math').length") == 1
    widths = "[...[...document.querySelectorAll('#dialog-container table')].find(t => t.textContent.includes('EN-DE')).rows].map(r => r.cells.length)"
    assert await dlg.eval(widths) == [3, 3, 3]
    assert (root/'readings/CRAFT.css').read_text() == (EXT/'craft/CRAFT.css').read_text()
    assert await dlg.eval("[...document.querySelectorAll('style')].some(s => s.textContent.includes('Solveit Reader'))")
    (root/'readings/CRAFT.css').write_text('/* mine */')

    r2 = await cdp.eval(run, sid=sid)
    assert r2['name'] == 'readings/why-cats-purr-a-study-2.ipynb'
    assert (root/'readings/CRAFT.css').read_text() == '/* mine */', 'an existing CRAFT.css must not be overwritten'

    await cdp.eval(f'chrome.storage.sync.set({json.dumps(settings)})', sid=sid)
    popup = await cdp.new_page()
    await popup.goto(f'chrome-extension://{ext_id}/popup.html')
    await popup.wait_for(f"document.getElementById('instance').value === {json.dumps(inst)}")
    assert await popup.eval("document.getElementById('folder').value") == 'readings'
