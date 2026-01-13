# Solveit Reader

A Chrome and Firefox extension that imports any webpage into Solveit for reading and annotation.

## Installation

### Chrome

1. Go to `chrome://extensions/` in Chrome
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `solveit-reader` folder

### Firefox

1. Go to `about:debugging` in Firefox
2. Click "This Firefox" in the left sidebar
3. Click "Load Temporary Add-on..."
4. Select the `manifest.json` file from the `solveit-reader` folder

**Note**: In Firefox, the extension is temporary and will be removed when you restart the browser. You'll need to reload it each session, or use Firefox Developer Edition/Nightly for persistent unsigned extensions.

## Usage

1. Navigate to any webpage you want to read in Solveit
2. Click the Solveit Reader extension icon
3. Configure settings (if needed):
   - **Instance URL**: Your Solveit instance (e.g., `https://yourname.solve.it.com`)
   - **Folder**: Where to save dialogs (default: `readings`)
4. Click "Import to Solveit"

The extension will:
- Create a new dialog named `{folder}/{sanitized-page-title}`
- Add a code cell with `from dialoghelper import url2note` and `url2note('{page-url}')`
- Auto-run the code to fetch the page content
- Open the new dialog in a new tab

## How It Works

1. **Dialog Creation**: POSTs to `/create_dialog_` with a sanitized version of the page title
2. **Content Setup**: Adds a code cell containing `url2note('...')` via `/add_relative_`
3. **Auto-execution**: Queues the code cell to run via `/add_runq_`
4. **Authentication**: Uses the browser's cookies API to include session cookies for authenticated remote instances

## Settings

Settings are saved persistently using the browser's sync storage, so your instance URL and folder preferences carry across browser sessions.

## Requirements

- Chrome or Firefox browser
- A running Solveit instance
- `dialoghelper` with `url2note` available in the Solveit environment
