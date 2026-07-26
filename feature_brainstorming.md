# Markdown Pro Feature Brainstorm

Markdown Pro already has a strong foundation: WYSIWYG editing, bidirectional sync, source-format preservation, Mermaid rendering, frontmatter handling, search, and an outline sidebar. Some newer capabilities appear implemented but are not yet highlighted in the README, so documenting them is an immediate discoverability win.

## Highest-value next features

### 1. Split WYSIWYG + source mode

- Side-by-side rich editor and raw Markdown.
- Synchronize selection and scroll position when users click a block in either pane.
- Provide an essential escape hatch for advanced Markdown that a WYSIWYG editor cannot safely represent.

### 2. Markdown linting and writing insights

- Detect skipped heading levels, missing image alt text, invalid links, duplicate headings, overly long lines, empty link text, and trailing whitespace.
- Add a **Fix all safe issues** command.
- This turns the extension into an authoring tool, not only an editor.

### 3. Image workflow

- Drag and drop and clipboard paste images directly into the document.
- Support a configurable asset folder, filename generation, automatic relative links, image compression, and optional WebP conversion.
- Particularly useful for README authors and technical documentation writers.

### 4. Interactive task dashboard

- Parse task lists across the workspace.
- Show open and completed tasks by file, label, or heading.
- Add commands such as **Toggle all tasks in section** and **Copy open tasks**.
- Task-list support is already a natural strength of Markdown Pro.

### 5. Frontmatter form editor

- Replace the raw YAML textarea with an optional structured form for title, description, tags, date, draft, author, and aliases.
- Support schemas for Hugo, Jekyll, Docusaurus, Astro, and Obsidian.
- Keep an advanced YAML mode for custom fields.

### 6. Link intelligence

- Show inline broken-link indicators.
- Update relative links across the workspace when a Markdown file is renamed or moved.
- Add a backlinks panel showing documents that link to the current file or heading.
- Autocomplete headings when creating internal links.

### 7. Interaction breadcrumb and section collapsing

- Show a sticky breadcrumb that reflects the heading hierarchy around the active cursor or scroll position, for example: `README > Installation > Configuration > Themes`.
- Let users click a breadcrumb item to scroll to that section.
- Add a collapse toggle beside each breadcrumb segment. Collapsing a heading hides its content until the next heading of equal or higher level.
- Show a compact placeholder such as `▶ Configuration — 8 blocks hidden`, which users can select to expand the section.
- Support nested collapse states: collapsing an H2 also hides its H3–H6 children.
- Keep collapse state as editor-only view state; never modify the underlying Markdown document.
- Provide keyboard shortcuts and Command Palette actions for collapse current section, expand current section, collapse all, and expand all.
- Add settings for breadcrumb visibility, section folding, restoring collapsed sections, and expanding sections that contain search matches.

## Differentiators worth building

### 8. Callout and admonition editor

- Provide rich UI for GitHub alerts (`[!NOTE]`, `[!WARNING]`), Obsidian callouts, and MkDocs or Docusaurus admonitions.
- Use colour-coded rendered blocks with a callout-type selector.
- The current source-preservation logic already accounts for callout markers, so this is a coherent next step.

### 9. Diagram-first Mermaid experience

- Add a visual diagram canvas for flowcharts and sequence diagrams.
- Keep the Mermaid source editable in a side panel with live syntax diagnostics.
- Support pan and zoom, SVG or PNG export, templates, and an **Insert Mermaid diagram** command.

### 10. Table enhancements

- Spreadsheet-like column resizing and row reordering.
- Paste directly from Excel or Google Sheets.
- Add CSV import/export plus table sort and filter actions.
- Consider lightweight computed columns later, but keep the first iteration focused on standard Markdown tables.

### 11. Document templates and snippets \[INTERESTING]

- Include templates for a README, ADR, changelog entry, meeting notes, issue template, pull request description, technical spec, and release notes.
- Allow workspace-configurable templates and variables for date, Git branch, repository name, and author.
- Surface templates in the slash-command menu.

### 12. Publish and export pipeline \[FUTURE PLANS]

- Export to HTML, PDF, DOCX, and styled standalone HTML.
- Offer preview themes independent from editor themes.
- Add optional publishing commands for GitHub Pages, a docs folder, or a static-site workflow.

### 13. Reading and focus modes

- Focus mode that dims non-active paragraphs.
- Typewriter mode that keeps the active line centered.
- Reading-time and word-count goals.
- A distraction-free paginated document layout.

## Good smaller wins

- **Find and replace:** build on existing find support with replace-one and replace-all.
- **Block drag handles:** reorder headings, paragraphs, tables, and callouts by dragging.
- **Version-history diff:** compare the current document with Git revisions in rendered mode.
- **Accessibility pass:** keyboard-first toolbar navigation, focus order, high-contrast checks, and semantic ARIA labels.
- **Collaboration-safe behaviour:** better support for Live Share and externally formatted edits without cursor jumps.
- **Per-project presets:** save a workspace profile for theme, content width, typography, frontmatter schema, and lint rules.
