# Changelog 

All notable changes to the **Markdown Pro** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.9.0] - 2026-07-26

### Added

* **Split code view** — a raw Markdown source pane that sits beside the rich text editor, toggled with the new **Code** button in the toolbar. Hidden by default.
* Editing in the code pane bypasses the WYSIWYG serializer entirely, so directives, raw HTML, and other custom syntax the rich schema cannot represent survive untouched.
* Resizable divider between the two panes — drag to adjust, double-click to reset. The width is remembered between sessions.
* Two-way navigation sync: clicking a block in the rich editor scrolls the code pane to the matching Markdown, and scrolling the code pane highlights the corresponding block in the rich editor.
* Word wrap in the code pane, so long lines stay within the pane width.
* New `markdownPro.showSource` setting to control whether the code view is open by default.

### Fixed

* Typing in the code pane no longer scrolls the view away from the cursor.
* Clicking in the rich editor no longer steals focus into the code pane.
* The rich pane is no longer rebuilt on every keystroke while typing in the code pane, removing the constant refresh flicker.
* Rich editor output can no longer overwrite text while the code pane is being edited.
* Pending edits are now flushed when the editor loses focus instead of being discarded, so the last keystrokes are never lost.
* The code pane stays pinned in the viewport instead of scrolling out of view with the document.

## [0.8.7] - 2026-06-05

### Added

* 6 new built-in themes: Material Ocean, Ayu Mirage, Cobalt2 (dark) and One Light, Ayu Light, Flexoki Light (light).

### Fixed

* Document outline panel now correctly adopts the active custom theme colors instead of staying locked to the VS Code editor theme colors.
* Heading color hierarchy in light themes corrected — H1 is now always the most visually prominent heading, with H2–H6 fading progressively, preventing smaller headings from appearing darker than larger ones.
* Toolbar, heading dropdown, and outline toggle button now match the active custom theme.
* Numbered and bulleted list markers (numbers/bullets) are now fully visible in all themes instead of rendering in a muted, low-contrast color.

## [0.8.5] - 2026-05-23

### Added

* Document outline (table of contents) sidebar with resizable width and click-to-navigate headings.

## [0.8.3] - 2026-05-16

### Fixed

* Non-breaking sync for GitHub-flavored markdown files.

## [0.8.0] - 2026-04-26

### Changed

* Updated package metadata.
* Compact UI refinements — tightened spacing and element sizing throughout the editor.

## [0.7.0] - 2026-04-10

### Changed

* Compact UI overhaul: reduced element sizes and padding in the editor toolbar and panels.
* Increased text area width for more writing space.

## [0.6.0] - 2026-04-03

### Added

* Diff-based sync check to avoid unnecessary document updates.

### Fixed

* Preserve existing markdown syntax when syncing edits back to source.

## [0.5.0] - 2026-03-27

### Fixed

* Sync issue between simultaneously open editors.
* Extra line spacing in list items.
* Caret color in inline code blocks.

## [0.4.0] - 2026-03-08

### Added

* Frontmatter (YAML) property rendering in the preview panel.

### Fixed

* Various bugs with general markdown file handling.
* Resolved display issues with Copilot-generated markdown files.

## [0.3.0] - 2026-03-06

### Added

* Mermaid diagram rendering with live preview.
* Search functionality within the editor.
* Performance improvements for Mermaid diagram rendering.

### Fixed

* Theme consistency in popup/modal components.

## [0.2.0] - 2026-03-03

### Added

* Settings support for user preferences.

### Changed

* Usability improvements across editing interactions.
* Marketplace publish preparation and metadata updates.

## [0.1.0] - 2026-03-02

### Added

* Live WYSIWYG editing of `.md` and `.markdown` files inside VS Code.
* Slash commands for quick insertion of headings, lists, code blocks, tables, images, and more.
* Editing toolbar for single-click formatting which is better
* Bidirectional sync between rich-text editor and source file.
* Smart debouncing for responsive editing during rapid changes.
* Relative image support with correct path resolution.
* 11 built-in themes: VS Code (match editor), GitHub Light/Dark, Dracula, Nord, One Dark, Tokyo Night, Solarized Light/Dark, and Gruvbox Light/Dark.
* Live theme preview with arrow-key browsing.
* Font size commands: increase, decrease, and reset.
* LaTeX math rendering (inline and block) via KaTeX.
* Table editing with toolbar controls for rows, columns, and alignment.

