# Markdown Pro

A WYSIWYG markdown editor for Visual Studio Code. Edit markdown files in a live, rich-text view where formatting renders instantly as you type, and every change syncs back to the underlying file in real time.

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/AshishSalaskar.markdown-pro)](https://marketplace.visualstudio.com/items?itemName=AshishSalaskar.markdown-pro)
[![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/AshishSalaskar.markdown-pro)](https://marketplace.visualstudio.com/items?itemName=AshishSalaskar.markdown-pro)

![Markdown Pro demo](resources/markdown-plus-demo.gif)

## Features

* **Live WYSIWYG editing** of `.md` and `.markdown` files directly inside VS Code.

* **Slash commands** — type `/` at the start of a new line to open a quick-insert menu for headings, lists, code blocks, tables, images, and more.

* **Editing toolbar** — a sleek formatting bar at the top of the editor lets you insert any Markdown element with a single click.

* **Bidirectional sync** — changes in the rich-text editor propagate to the source file and vice versa, instantly.

* **Optional source pane** — edit raw Markdown beside the rich editor while preserving directives, HTML, comments, and unsupported syntax.

* **Document outline** — browse headings in a resizable sidebar and jump directly to a section.

* **Find in document** — search, navigate matches, and optionally match case without modifying the document.

* **Smart debouncing** keeps the UI responsive during rapid edits.

* **Editable Mermaid previews** — click **EDIT** on a diagram to change its source with a live preview and automatic document sync.

* **Relative image support** — paths like `![](./img.png)` resolve correctly in the editor.

* **32 built-in palettes**, plus a VS Code-matching mode, with Markdown-focused heading contrast, readable code colors, and consistent source/outline panels.

* **Live theme preview** — browse themes with arrow keys before committing.

* Built on [Milkdown Crepe](https://milkdown.dev/) for a lightweight, fast editing experience.

## Getting Started

### Opening a File

Use any of these methods to open a markdown file in the WYSIWYG editor:

* **Explorer context menu** — right-click any `.md` file in the sidebar and select **Open with Markdown Pro**.

* **Editor title menu** — right-click the editor tab and select **Open with Markdown Pro**.

* **Command Palette** — press `Ctrl+Shift+P` (`Cmd+Shift+P` on macOS) and run **Open with Markdown Pro**.

### Setting as the Default Editor

1. Open any `.md` file.
2. Click the editor selector in the top-right corner (or run **View: Reopen Editor With...** from the Command Palette).
3. Select **Markdown Pro** from the list.
4. Optionally, click **Configure default editor for '\*.md'** and choose **Markdown Pro** to always open markdown files with it.

## Changing Themes

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
2. Run **Markdown Pro: Change Theme**.
3. Use the arrow keys to live-preview each theme, then press Enter to apply.

You can also set the theme in VS Code Settings under `markdownPro.theme`.

### Available Themes

| Theme           | Style |
| --------------- | ----- |
| GitHub Light    | Light |
| GitHub Dark     | Dark  |
| Dracula         | Dark  |
| Nord            | Dark  |
| One Dark        | Dark  |
| Tokyo Night     | Dark  |
| Solarized Light | Light |
| Solarized Dark  | Dark  |
| Gruvbox Light   | Light |
| Gruvbox Dark    | Dark  |
| Catppuccin Mocha | Dark |
| Catppuccin Latte | Light |
| Rosé Pine       | Dark  |
| Rosé Pine Dawn  | Light |
| Monokai Pro     | Dark  |
| Everforest Dark | Dark  |
| Material Ocean  | Dark  |
| Ayu Mirage      | Dark  |
| Cobalt2         | Dark  |
| One Light       | Light |
| Ayu Light       | Light |
| Flexoki Light   | Light |
| Night Owl       | Dark  |
| Ayu Dark        | Dark  |
| Catppuccin Macchiato | Dark |
| Rosé Pine Moon  | Dark  |
| Kanagawa Wave   | Dark  |
| Light Owl       | Light |
| Quiet Light     | Light |
| PaperColor Light | Light |
| Material Lighter | Light |
| Tokyo Night Day | Light |
| VS Code         | Matches editor |

The palettes are inspired by their namesakes, with low-contrast accents adjusted
for reading Markdown. All six heading levels use solid, semibold text rather
than fading into the background. Links stay underlined, and code highlighting,
quotes, tables, source editing, and the outline follow the same palette. VS Code
mode preserves your editor's light, dark, or high-contrast colors.
Links retain their readable color on hover, and link preview/edit popups use
explicit palette colors rather than inheriting potentially invisible text.

## Supported Markdown Elements

Markdown Pro renders all standard Markdown and GitHub Flavored Markdown (GFM) elements in the WYSIWYG editor. Type the syntax below and it renders instantly.

### Text Formatting

| Element       | Markdown Syntax         | Result                |
| ------------- | ----------------------- | --------------------- |
| Bold          | `**bold text**`         | **bold text**         |
| Italic        | `*italic text*`         | *italic text*         |
| Bold + Italic | `***bold and italic***` | ***bold and italic*** |
| Strikethrough | `~~strikethrough~~`     | ~~strikethrough~~     |
| Inline Code   | `` `code` ``            | `code`                |

### Headings

| Element   | Markdown Syntax    |
| --------- | ------------------ |
| Heading 1 | `# Heading 1`      |
| Heading 2 | `## Heading 2`     |
| Heading 3 | `### Heading 3`    |
| Heading 4 | `#### Heading 4`   |
| Heading 5 | `##### Heading 5`  |
| Heading 6 | `###### Heading 6` |

### Block Elements

| Element         | Markdown Syntax                      | Notes                                    |
| --------------- | ------------------------------------ | ---------------------------------------- |
| Blockquote      | `> quoted text`                      | Nest with `>>` for deeper levels         |
| Bullet List     | `- item` or `* item`                 | Indent with 2 spaces for nested items    |
| Ordered List    | `1. item`                            | Numbers increment automatically          |
| Task List       | `- [ ] todo` / `- [x] done`          | Checkboxes toggle on click in the editor |
| Code Block      | ` ``` ` + language on a new line     | Syntax highlighting via CodeMirror       |
| Horizontal Rule | `---` or `***`                       | Inserts a divider line                   |
| Paragraph       | Plain text separated by a blank line | Default block type                       |
| Hard Line Break | `Shift+Enter` or two trailing spaces | Forces a newline within a paragraph      |

### Links and Images

| Element | Markdown Syntax                    | Notes                                    |
| ------- | ---------------------------------- | ---------------------------------------- |
| Link    | `[text](https://url)`              | Tooltip appears on hover for editing     |
| Image   | `![alt text](./path/to/image.png)` | Relative paths resolve from the file dir |

### Tables

Create tables using pipes and dashes:

```text
| Column A | Column B |
|----------|----------|
| Cell 1   | Cell 2   |
```

Use the table toolbar to add or remove rows and columns, and to set column alignment.

### Math (LaTeX)

| Element     | Syntax                 | Notes                        |
| ----------- | ---------------------- | ---------------------------- |
| Inline Math | `$E = mc^2$`           | Rendered inline with KaTeX   |
| Block Math  | `$$\sum_{i=1}^n x_i$$` | Rendered as a centered block |

### Mermaid Diagrams

Use a fenced code block with the language `mermaid` to render a diagram:

````markdown
```mermaid
flowchart LR
  A[Write Markdown] --> B[Live preview]
```
````

Click
**EDIT** in its preview toolbar to open the source beside the diagram (stacked
on narrow screens). Changes sync automatically to the Markdown document as you
type; the diagram refreshes after a short 300 ms pause. **DONE** only closes the
editor—it is not a save button. Saving the file still uses VS Code's normal save
or Auto Save behavior.

Zoom/pan and the source caret stay in place during preview updates. If the code
is temporarily invalid, an error appears while the last valid diagram remains
visible; the edited source still syncs to the document.

## Keyboard Shortcuts

> `Mod` is `Ctrl` on Windows/Linux and `Cmd` on macOS.

### Text Formatting

| Shortcut    | Action               |
| ----------- | -------------------- |
| `Mod+B`     | Toggle bold          |
| `Mod+I`     | Toggle italic        |
| `Mod+E`     | Toggle inline code   |
| `Mod+Alt+X` | Toggle strikethrough |

### Block Formatting

| Shortcut      | Action                 |
| ------------- | ---------------------- |
| `Mod+Alt+1–6` | Convert to heading 1–6 |
| `Mod+Alt+0`   | Convert to paragraph   |
| `Mod+Shift+B` | Wrap in blockquote     |
| `Mod+Shift+8` | Wrap in bullet list    |
| `Mod+Shift+7` | Wrap in ordered list   |
| `Mod+Shift+C` | Wrap in code block     |
| `Shift+Enter` | Insert hard line break |

### Table Navigation

| Shortcut    | Action                                |
| ----------- | ------------------------------------- |
| `Mod+]`     | Move to next cell                     |
| `Mod+[`     | Move to previous cell                 |
| `Mod+Enter` | Exit table and insert paragraph below |

### General

| Shortcut | Action |
| -------- | ------ |
| `Mod+Z`  | Undo   |
| `Mod+Y`  | Redo   |
| `Mod+S`  | Save   |

### Slash Commands

Type `/` at the beginning of a new line to open the slash-command menu, which provides quick access to insert headings, lists, code blocks, tables, images, and more.

## Font Size

Adjust the editor font size with these commands (available in the Command Palette):

| Command                              | Description              |
| ------------------------------------ | ------------------------ |
| **Markdown Pro: Increase Font Size** | Increase by 2 px         |
| **Markdown Pro: Decrease Font Size** | Decrease by 2 px         |
| **Markdown Pro: Reset Font Size**    | Reset to default (16 px) |

You can also set the size directly in VS Code Settings under `markdownPro.fontSize` (range: 8–40 px).

## Development Setup

Development requires Node.js 20 or later. The published extension itself only
requires the supported VS Code version listed below.

Install dependencies, build the extension, package it, and install the newest generated VSIX into VS Code:

```bash
npm install
npm run build
npm run package && code --install-extension "$(ls -1v ./*.vsix | tail -n 1)" --force
```

To run the browser regression suite, install Chromium once and run the tests:

```bash
npx playwright install chromium
npm test
```

To publish a Marketplace release, first authenticate for the configured
publisher, then publish. You can use either a global `vsce` installation or
`npx`; do not commit or paste your Personal Access Token into source files.

```bash
npx @vscode/vsce login ashishsalaskar
npx @vscode/vsce publish
```

For a prebuilt package, use:

```bash
npx @vscode/vsce publish --packagePath ./markdown-pro-0.9.1.vsix
```

## Requirements

* Visual Studio Code v1.85.0 or later

## License

See the [LICENSE](LICENSE) file for details.
