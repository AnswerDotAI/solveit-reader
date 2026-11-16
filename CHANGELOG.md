# Changelog

## [Unreleased]

### Added
- The first import into a folder uploads `craft/CRAFT.css` to it when the folder has no `CRAFT.css`. Solveit applies it to every dialog in the folder: notes read as a serif page column with their buttons shown on hover or selection, while code and prompt messages keep their cards. The extension never overwrites an existing `CRAFT.css` and adds none at the root. Solveit loads CRAFT styles before its own, so the file nests its rules in `body` to win ties.

### Fixed
- Wikipedia formulas imported as plain text. Wikipedia's MathML has no TeX annotation; the TeX is in each `<math>` element's `data-mw` JSON (`body.extsrc`), which the extension now reads.
- arXiv tables lost cells, and the maths in them, when a header cell had a `colspan` or `rowspan`. The header row was narrower than the data rows, and GFM drops cells beyond the header's width. Spanned cells now become empty cells, and every row has the table's full width.
- A `|` inside maths in a table cell split the cell. Maths in a table cell now writes `|` as `\vert` and `\|` as `\Vert`.
- `\[` and `\]` inside TeX lost their backslashes, as in `a \\[2pt] b`. The extension removed escaped brackets from the whole markdown after conversion. Turndown now leaves `[` and `]` in page text unescaped, and the extension no longer edits the markdown afterwards.

## [3.0.0] - 2026-10-03

Solveit now stores dialogs through RustyGate and no longer has the `/add_relative_` route. Version 2.0 could create a dialog but could not add the page to it.

### Changed
- The import builds the dialog as a notebook in the browser and sends it to `/upload_file_`, the route Solveit's Upload dialog uses. Tested against Solveit 0.0.117 and RustyGate 0.1.25.
- The import runs in a background service worker. Closing the popup no longer aborts it.
- A title that is already taken gets a numbered name (`title-2.ipynb`). Version 2.0 appended to the existing dialog.
- A 403 from the instance reports "Not signed in to Solveit".

### Removed
- The `cookies` and `activeTab` permissions and the hand-built `Cookie` header. Requests send the instance cookies through `credentials: 'include'`.
- `web_accessible_resources`: `chrome.scripting.executeScript` does not need it.
- The `#ai` suffix on image links. Current Solveit gives it no meaning: web images stay links, and only attachments enter model context.

### Fixed
- arXiv display equations rendered as raw `<math>` HTML. LaTeXML wraps them in heading-less `<table class="ltx_equation">` elements, which the GFM table plugin keeps verbatim. They now become `$$...$$` blocks, including `align` groups.
- arXiv data tables arrived as raw HTML, with inline tags such as `<cite>` shown as text. LaTeXML marks header cells with `<td class="ltx_th">`, so the GFM plugin saw no heading row. Tables without a heading row now convert with their first row as the header, and newlines inside cells collapse to spaces.
- arXiv figures served as `<object type="image/svg+xml">` were dropped, leaving only their captions. They now import as image links.

### Added
- `tests/test_import.py`: an end-to-end test in headless Chrome through fastcdp, against an isolated Solveit instance.

---
## [2.0.0] - 2026-01-14

### Changed
- **Architecture overhaul**: HTML→Markdown conversion now happens client-side in the browser instead of server-side in Python
- Content is now added as a **note** instead of a code cell that runs `url2note()`
- Refactored all code to follow fastai style guide

### Added
- **Turndown.js integration** for HTML→Markdown conversion
- **GFM plugin** for tables, strikethrough, task lists
- **MathML→LaTeX conversion** extracts TeX from `<annotation>` elements
- **ToC extraction** for arXiv and other sites with table of contents
- **Smart content selection** picks largest matching element to avoid grabbing comments
- **`#ai` suffix** on images for solveit AI visibility
- **Element filtering** removes nav, buttons, popups, cookie banners, etc.
- `scripting` permission and `web_accessible_resources` in manifest

### Fixed
- JS-rendered pages (SPAs, React apps) now work since we read from the live DOM
- Bracket escaping issue where `\[...\]` triggered KaTeX block math

### Dependencies
- `turndown.js` (v7.2.2)
- `turndown-plugin-gfm.js`

---

## [1.0.0] - Initial release

- Basic URL import via `url2note()` Python call
