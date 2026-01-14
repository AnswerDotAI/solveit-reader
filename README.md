# Solveit Reader

A Chrome extension that imports any webpage into Solveit for reading and annotation.

## Features

- **Works with JS-heavy sites** — Converts the fully-rendered DOM, not just initial HTML
- **MathML support** — Extracts LaTeX from academic sites (arXiv, Wikipedia, etc.)
- **Table of contents** — Automatically extracts and prepends ToC when available
- **Smart content selection** — Finds the main article content, filters out nav/ads/cruft
- **AI-ready images** — Adds `#ai` suffix so Solveit can "see" images

## Installation

1. Go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `solveit-reader` folder

## Usage

1. Navigate to any webpage
2. Click the Solveit Reader extension icon
3. Configure settings (if needed):
   - **Instance URL**: Your Solveit instance (e.g., `http://localhost:6001`)
   - **Folder**: Where to save dialogs (default: `readings`)
4. Click "Import to Solveit"

The extension will:
- Convert the page to clean markdown (in-browser via Turndown.js)
- Create a new dialog named `{folder}/{sanitized-page-title}`
- Add the content as a note (no code execution needed)
- Open the dialog in a new tab

## How It Works

1. **Content script injection**: Injects Turndown.js into the active tab
2. **DOM conversion**: Converts the fully-rendered DOM to markdown client-side
3. **Dialog creation**: POSTs to `/create_dialog_` with sanitized title
4. **Note addition**: Adds markdown directly as a note via `/add_relative_`
5. **Authentication**: Uses Chrome's cookies API for authenticated instances

## Files

```
solveit-reader/
├── manifest.json           # Extension config
├── popup.html              # Extension popup UI
├── popup.js                # Popup logic, API calls
├── content.js              # DOM→Markdown conversion
├── turndown.js             # HTML→Markdown library
├── turndown-plugin-gfm.js  # GFM tables/strikethrough
├── README.md
└── CHANGELOG.md
```

## Requirements

- Chrome browser
- A running Solveit instance

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.
