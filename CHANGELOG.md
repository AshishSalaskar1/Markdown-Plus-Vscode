# Changelog 

All notable changes to the **Markdown Pro** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

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

