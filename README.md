# Solveit Reader

A Chrome extension that imports the page you are reading into a Solveit dialog as notes. It converts the rendered DOM to markdown in the browser, so pages built by JavaScript import as you see them. It targets Solveit instances backed by RustyGate, and was tested against Solveit 0.0.117 with RustyGate 0.1.25.

## Features

- Converts the fully rendered DOM, so JavaScript-heavy sites import as displayed
- Extracts LaTeX from MathML, as on arXiv and Wikipedia
- Prepends the page's table of contents when it has one
- Picks the main article element and drops navigation, footers, cookie banners and similar

## Installation

1. Open `chrome://extensions/`
2. Turn on "Developer mode"
3. Click "Load unpacked"
4. Select the `solveit-reader` folder

## Usage

1. Sign in to your Solveit instance in Chrome
2. Open the page you want to import
3. Click the Solveit Reader icon and set the instance URL and the folder (default `readings`)
4. Click "Import to Solveit"

The extension saves the dialog as `{folder}/{sanitized-page-title}.ipynb`, with a `Source:` note followed by the page content as a note, and opens it in a new tab. If a dialog with that name exists, the new one is numbered: `-2`, `-3`, and so on. You can close the popup while the import runs.

## How it works

1. `popup.js` saves the settings and asks the background service worker to import the active tab
2. `background.js` injects Turndown and `content.js` into the tab and receives the page as markdown
3. `content.js` finds the main content and converts it to GitHub-flavoured markdown
4. The worker checks `/static/{name}` to find a free dialog name. It builds a notebook with two markdown cells and POSTs it to `/upload_file_`, the route Solveit's own Upload dialog uses
5. The worker opens `/dialog_?name={name}` in a new tab

Requests send your Chrome cookies for the instance, so you must be signed in to it. A 403 from the instance reports "Not signed in to Solveit".

## Files

```
solveit-reader/
├── manifest.json           # Extension config
├── popup.html              # Popup UI
├── popup.js                # Settings and the import button
├── background.js           # Service worker: conversion, naming, upload, open
├── content.js              # DOM to markdown conversion
├── turndown.js             # HTML to markdown library
├── turndown-plugin-gfm.js  # GFM tables, strikethrough, task lists
├── tests/test_import.py    # Headless browser test
├── README.md
└── CHANGELOG.md
```

## Testing

`tests/test_import.py` runs the extension in a headless Chrome through fastcdp, against a Solveit instance it starts on a temporary root. It needs `solveit` on `PATH` and a Chrome build that accepts `--load-extension` (Chrome for Testing or Chromium). Set `FASTCDP_CHROME` to the browser path. The default is the Playwright Chromium under `~/.cache/ms-playwright`.

```
pytest -q
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.
