***

title: Markdown Pro
description: A WYSIWYG markdown editor extension for VS Code
ms.date: 2026-03-02
ms.topic: overview
keywords:

* markdown

* wysiwyg

* vscode extension

* milkdown

***

# Markdown Pro

A WYSIWYG markdown editor extension for Visual Studio Code. Edit markdown files in a live, rich-text view where formatting renders instantly as you type, and every change syncs back to the underlying file in real time.

## Features

* Live WYSIWYG editing of `.md` and `.markdown` files directly inside VS Code.

* Bidirectional sync between the rich-text editor and the source file. Changes in either direction propagate instantly.

* Triple-guard sync strategy prevents infinite edit loops and discards stale updates.

* Dual-timer debounce (50 ms idle, 150 ms typing) keeps the UI responsive during rapid edits.

* Right-click any markdown file in the Explorer or editor title bar and select "Open with Markdown Pro".

* Open from the Command Palette with the `Open with Markdown Pro` command.

* Relative image paths resolve correctly inside the editor (e.g., `![](./img.png)<!-- -->`).

* Content Security Policy protects the webview while allowing Milkdown's inline styles.

* Built on [Milkdown Crepe](https://milkdown.dev/) for a lightweight, fast editing experience.

* **32 built-in palettes**, plus VS Code-matching mode, with Markdown-focused contrast and typography.

* **Live theme preview** — open `Markdown Pro: Change Theme` from the Command Palette and preview themes with arrow keys before committing.

* Theme selection also available in VS Code Settings under `markdownPro.theme`.

## Prerequisites

* [Node.js](https://nodejs.org/) v18 or later

* [npm](https://www.npmjs.com/) v9 or later

* [Visual Studio Code](https://code.visualstudio.com/) v1.85.0 or later

## Development Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/<your-username>/markdown-plus.git
cd markdown-plus
npm install
```

### 2. Build the extension

Run a one-time build that compiles both the extension host code and the webview bundle into `dist/`:

```bash
npm run build
```

For continuous rebuilds during development, start the watch task:

```bash
npm run watch
```

### 3. Project structure

| Path                         | Purpose                                         |
| ---------------------------- | ----------------------------------------------- |
| `src/extension.ts`           | Extension entry point, command registration     |
| `src/MarkdownProProvider.ts` | Custom editor provider with bidirectional sync  |
| `src/themes.ts`              | Theme definitions and QuickPick command         |
| `src/utils/html.ts`          | Generates the webview HTML shell                |
| `src/utils/nonce.ts`         | CSP nonce helper                                |
| `webview/main.ts`            | Webview entry point, Milkdown Crepe setup       |
| `webview/styles/editor.css`  | Base editor styles (VS Code variable mappings)  |
| `webview/styles/themes.css`  | Theme definitions (32 custom palettes)          |
| `esbuild.config.mjs`         | Build configuration for extension and webview   |
| `dist/`                      | Compiled output (extension.js, webview\.js/css) |
| `dist/chunks/`               | Shared modules and on-demand diagram/language code |
| `dist/assets/`               | Fonts loaded only when the browser needs them |

## Running the Extension Locally

### Using the Extension Development Host

1. Open the `markdown-plus` folder in VS Code.
2. Make sure the project is built (`npm run build` or have `npm run watch` running).
3. Press `F5` (or go to **Run > Start Debugging**).

   * This launches a new VS Code window called the **Extension Development Host** with the extension loaded.
4. In the Extension Development Host window, open any `.md` file.
5. Use one of these methods to activate the WYSIWYG editor:

   * Right-click the file in the Explorer sidebar and select **Open with Markdown Pro**.

   * Right-click the editor tab title and select **Open with Markdown Pro**.

   * Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run **Open with Markdown Pro**.

> \[!TIP]
> If you have `npm run watch` running, any code changes rebuild automatically. Reload the Extension Development Host window (`Ctrl+Shift+P` > **Developer: Reload Window**) to pick up changes.

### Installing from a VSIX package

To test the packaged extension outside the development host:

1. Package the extension:

   ```bash
   npm run package
   ```

   This produces a `markdown-pro-0.1.0.vsix` file in the project root.

2. Install the VSIX in VS Code:

   ```bash
   code --install-extension markdown-pro-0.1.0.vsix
   ```

3. Reload VS Code, then open any markdown file and use the **Open with Markdown Pro** command.

### Setting Markdown Pro as the default editor

After installing the extension, you can make it the default editor for markdown files:

1. Open any `.md` file.
2. Click the editor selector in the top-right corner of the editor (or run `View: Reopen Editor With...` from the Command Palette).
3. Select **Markdown Pro** from the list.
4. Optionally, click **Configure default editor for '\*.md'** and choose **Markdown Pro** to open all markdown files with it by default.

## Browser regression tests

The tests cover minimal document edits and indexed source navigation, plus
headless Chromium checks for the complete editor, lazy loading, source sync,
outline updates, and Mermaid zoom/pan. The browser suite builds and serves the
production assets using the actual webview HTML and Content Security Policy.

```bash
npx playwright install chromium
npm test
```

The browser tests require Node.js 20 or later. On Linux, Playwright may also
require system libraries (`npx playwright install --with-deps chromium`).

The plain-Markdown startup test checks that Mermaid is not requested and that
total startup JavaScript stays below 3 MB (decoded, including shared chunks).
Its `startup-javascript-bytes` attachment records the measured byte count.

The editor suite also checks table edits/controls, task toggles, search, image
paths, frontmatter preservation, undo/redo, stale updates, and focus-handoff
sync. Browser checks fail on unhandled runtime errors or CSP violations. The
provider suite executes the real extension-side message handler with a mocked
VS Code API, including rejected writes, concurrent updates, and disposal; it is
not a substitute for a manual Extension Development Host smoke test.

To repeat the full production suite for timing-sensitive regressions:

```bash
npm test -- --repeat-each=2 --workers=3
```

For a development-bundle smoke test on Linux/macOS:

```bash
MARKDOWN_PRO_TEST_BUILD=development npm test -- tests/editor.spec.ts --grep 'EDIT opens|table cell edits|task-checkbox|search, case|relative images still'
```

`webview/table-view.ts` adapts ordinary table-cell clicks to native ProseMirror
selection. This avoids Milkdown 7.18's deferred transaction using stale editor
state while retaining table-button/drag handling. Recheck this adapter and its
table interaction tests when upgrading Milkdown.

## Theme styling

Use `body[data-theme]` as the theme anchor: Milkdown can replace its wrapper
during document loading, so styling must not depend on an attribute on that
wrapper. Custom palettes define Crepe tokens and scoped VS Code-token aliases
so the document, source pane, outline, and preview controls stay consistent.

Heading hierarchy uses size, weight, and spacing rather than reduced opacity.
CodeMirror emits stable `tok-*` classes; their CSS colors change with the
palette without rebuilding the code editor. The existing CodeMirror/Lezer
versions are reused—no second syntax engine or theme runtime is loaded.

`tests/themes.spec.ts` checks rendered text contrast (target: at least 4.5:1),
heading sizes, highlighted code, link hover/preview/edit states, opposite-polarity
host themes, document replacement, and light/dark/high-contrast fallback. It also
checks that the theme picker and settings list stay aligned. Selected theme screenshots
are saved under `test-results/` for visual inspection.

Palette references include [Dracula](https://draculatheme.com/spec),
[Nord](https://www.nordtheme.com/docs/colors-and-palettes),
[Solarized](https://ethanschoonover.com/solarized/), and
[Catppuccin](https://github.com/catppuccin/palette),
[Night Owl / Light Owl](https://github.com/sdras/night-owl-vscode-theme),
[Rosé Pine](https://github.com/rose-pine/neovim), and
[Kanagawa](https://github.com/rebelot/kanagawa.nvim). These are Markdown-oriented
adaptations, not claims of pixel-identical official ports.

## Scripts Reference

| Script     | Command                     | Description                             |
| ---------- | --------------------------- | --------------------------------------- |
| Build      | `npm run build`             | One-time build of extension and webview |
| Watch      | `npm run watch`             | Continuous rebuild on file changes      |
| Test       | `npm test`                  | Editor and performance regression tests |
| Prepublish | `npm run vscode:prepublish` | Production build (minified)             |
| Package    | `npm run package`           | Create a `.vsix` file for distribution  |

## Technology Stack

* [Milkdown](https://milkdown.dev/) (Crepe) for the WYSIWYG editor

* [esbuild](https://esbuild.github.io/) for bundling

* [TypeScript](https://www.typescriptlang.org/) for type safety

* VS Code [Custom Editor API](https://code.visualstudio.com/api/extension-guides/custom-editors) for the editor integration

## License

See the [LICENSE](LICENSE) file for details.
