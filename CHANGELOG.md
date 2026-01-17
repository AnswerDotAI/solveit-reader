# Changelog

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
