/**
 * Markdown Plus — Webview entry point
 *
 * Initialises Milkdown Crepe and wires up the bidirectional
 * message bridge between the WYSIWYG editor and the extension host.
 */

import { Crepe } from "@milkdown/crepe";
import { replaceAll } from "@milkdown/utils";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import "./styles/editor.css";

// Wrap in async IIFE — esbuild IIFE format does not support top-level await.
(async () => {
  // -------------------------------------------------------------------
  // VS Code API & sync state
  // -------------------------------------------------------------------

  const vscode = acquireVsCodeApi();

  let currentVersion = 0;
  let suppressOnChange = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastEditTime = 0;

  const DEBOUNCE_TYPING = 150;
  const DEBOUNCE_IDLE = 50;

  // -------------------------------------------------------------------
  // Milkdown Crepe initialisation
  // -------------------------------------------------------------------

  const crepe = new Crepe({
    root: document.getElementById("editor")!,
    defaultValue: "",
  });

  await crepe.create();

  // -------------------------------------------------------------------
  // Outgoing: content change → extension host  (dual-timer debounce)
  // -------------------------------------------------------------------

  crepe.on((listener: any) => {
    listener.markdownUpdated((_ctx: any, markdown: string, prevMarkdown: string) => {
      if (suppressOnChange || markdown === prevMarkdown) return;

      const now = Date.now();
      const timeSinceLastEdit = now - lastEditTime;
      lastEditTime = now;

      if (debounceTimer) clearTimeout(debounceTimer);

      // Shorter debounce when idle, longer during rapid typing.
      const delay = timeSinceLastEdit > 500 ? DEBOUNCE_IDLE : DEBOUNCE_TYPING;

      debounceTimer = setTimeout(() => {
        currentVersion++;
        vscode.postMessage({ type: "edit", markdown, version: currentVersion });
      }, delay);
    });
  });

  // -------------------------------------------------------------------
  // Incoming: extension host → webview  (init / update)
  // -------------------------------------------------------------------

  window.addEventListener("message", (event) => {
    const { type, markdown, version } = event.data;

    if ((type === "init" || type === "update") && version > currentVersion) {
      currentVersion = version;
      suppressOnChange = true;
      crepe.editor.action(replaceAll(markdown));
      suppressOnChange = false;
    }
  });

  // -------------------------------------------------------------------
  // Keyboard shortcut coexistence (Step 5.3)
  // -------------------------------------------------------------------
  // Milkdown / ProseMirror captures keyboard events inside the webview
  // iframe, so rich-text shortcuts (Ctrl+B, Ctrl+I, Tab, Enter) work
  // out-of-the-box without conflicting with VS Code shortcuts.
  //
  // Undo / Redo:
  //   - Ctrl+Z / Ctrl+Y are handled by ProseMirror's history plugin
  //     inside the webview.  Each undo fires `markdownUpdated`, which
  //     propagates the change to the extension host as a WorkspaceEdit.
  //   - VS Code's document-level undo operates on WorkspaceEdits,
  //     which is a separate undo stack.  Because the webview iframe
  //     consumes the keypress, VS Code's undo is not triggered, so
  //     there is no conflict for v1.
  //
  // Ctrl+S is forwarded to VS Code by the webview infrastructure and
  // saves the underlying TextDocument as expected.

  // -------------------------------------------------------------------
  // Signal that the webview is ready to receive content
  // -------------------------------------------------------------------

  vscode.postMessage({ type: "ready" });
})();
