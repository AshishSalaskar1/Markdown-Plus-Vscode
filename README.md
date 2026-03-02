# Markdown Pro

![1.00](Markdown_Plus_Logo_v2.png)

A WYSIWYG markdown editor for Visual Studio Code. Edit markdown files in a live, rich-text view where formatting renders instantly as you type, and every change syncs back to the underlying file in real time.

## Features

* **Live WYSIWYG editing** of `.md` and `.markdown` files directly inside VS Code.

* **Slash commands** — type `/` at the start of a new line to open a quick-insert menu for headings, lists, code blocks, tables, images, and more.

* **Editing toolbar** — a sleek formatting bar at the top of the editor lets you insert any Markdown element with a single click.

* **Bidirectional sync** — changes in the rich-text editor propagate to the source file and vice versa, instantly.

* **Smart debouncing** keeps the UI responsive during rapid edits.

* **Relative image support** — paths like `![](./img.png)` resolve correctly in the editor.

* **11 built-in themes** including GitHub Light/Dark, Dracula, Nord, One Dark, Tokyo Night, Solarized, and Gruvbox.

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
| Default         | Light |

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
| **Markdown Pro: Increase Font Size** | Increase by 1 px         |
| **Markdown Pro: Decrease Font Size** | Decrease by 1 px         |
| **Markdown Pro: Reset Font Size**    | Reset to default (16 px) |

You can also set the size directly in VS Code Settings under `markdownPro.fontSize` (range: 8–40 px).

## Requirements

* Visual Studio Code v1.85.0 or later

## License

See the [LICENSE](LICENSE) file for details.
