import * as vscode from 'vscode';
import { getWebviewHtml } from './utils/html';
import { broadcastTheme, getActiveTheme } from './themes';
import { computeTextChange } from './utils/text-change';

/** Read the persisted font size from configuration. */
export function getActiveFontSize(): number {
  return vscode.workspace
    .getConfiguration('markdownPro')
    .get<number>('fontSize', 16);
}

/** Send a font-size change message to all open webview panels. */
export function broadcastFontSize(
  panels: vscode.WebviewPanel[],
  fontSize: number,
): void {
  for (const panel of panels) {
    panel.webview.postMessage({ type: 'fontSizeChange', fontSize });
  }
}

/** Read the persisted line height from configuration. */
export function getActiveLineHeight(): number {
  return vscode.workspace
    .getConfiguration('markdownPro')
    .get<number>('lineHeight', 1.6);
}

/** Send a line-height change message to all open webview panels. */
export function broadcastLineHeight(
  panels: vscode.WebviewPanel[],
  lineHeight: number,
): void {
  for (const panel of panels) {
    panel.webview.postMessage({ type: 'lineHeightChange', lineHeight });
  }
}

/** Font family presets mapped to CSS font stacks. */
const FONT_FAMILY_MAP: Record<string, string> = {
  default: '',
  serif: 'Georgia, "Times New Roman", Times, "Noto Serif", serif',
  'sans-serif': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  monospace: 'var(--vscode-editor-font-family, "SF Mono", Monaco, Menlo, Consolas, "Ubuntu Mono", monospace)',
};

/** Read the persisted font family from configuration. */
export function getActiveFontFamily(): string {
  const raw = vscode.workspace
    .getConfiguration('markdownPro')
    .get<string>('fontFamily', 'default');
  return FONT_FAMILY_MAP[raw] ?? raw;
}

/** Send a font-family change message to all open webview panels. */
export function broadcastFontFamily(
  panels: vscode.WebviewPanel[],
  fontFamily: string,
): void {
  for (const panel of panels) {
    panel.webview.postMessage({ type: 'fontFamilyChange', fontFamily });
  }
}

/** Read the persisted content width from configuration. */
export function getActiveContentWidth(): number {
  return vscode.workspace
    .getConfiguration('markdownPro')
    .get<number>('contentWidth', 0);
}

/** Send a content-width change message to all open webview panels. */
export function broadcastContentWidth(
  panels: vscode.WebviewPanel[],
  contentWidth: number,
): void {
  for (const panel of panels) {
    panel.webview.postMessage({ type: 'contentWidthChange', contentWidth });
  }
}

/** Read the persisted toolbar visibility from configuration. */
export function getActiveShowToolbar(): boolean {
  return vscode.workspace
    .getConfiguration('markdownPro')
    .get<boolean>('showToolbar', true);
}

/** Send a toolbar visibility change message to all open webview panels. */
export function broadcastShowToolbar(
  panels: vscode.WebviewPanel[],
  showToolbar: boolean,
): void {
  for (const panel of panels) {
    panel.webview.postMessage({ type: 'showToolbarChange', showToolbar });
  }
}

/** Read the persisted outline visibility from configuration. */
export function getActiveShowOutline(): boolean {
  return vscode.workspace
    .getConfiguration('markdownPro')
    .get<boolean>('showOutline', false);
}

/** Send an outline visibility change message to all open webview panels. */
export function broadcastShowOutline(
  panels: vscode.WebviewPanel[],
  showOutline: boolean,
): void {
  for (const panel of panels) {
    panel.webview.postMessage({ type: 'showOutlineChange', showOutline });
  }
}

/** Read the persisted source-pane (code view) visibility from configuration. */
export function getActiveShowSource(): boolean {
  return vscode.workspace
    .getConfiguration('markdownPro')
    .get<boolean>('showSource', false);
}

/** Send a source-pane visibility change message to all open webview panels. */
export function broadcastShowSource(
  panels: vscode.WebviewPanel[],
  showSource: boolean,
): void {
  for (const panel of panels) {
    panel.webview.postMessage({ type: 'showSourceChange', showSource });
  }
}

/**
 * CustomTextEditorProvider that drives the Markdown Pro WYSIWYG editor.
 *
 * Bidirectional sync between the VS Code TextDocument and the webview uses
 * a triple-guard strategy to prevent infinite edit loops:
 *   1. `pendingEdits` — expected-content tickets for in-flight WorkspaceEdits,
 *      so only matching events are treated as our own, including overlapping
 *      edits. Rejected edits must not swallow a later external change.
 *   2. `lastSentContent` — content-equality check to suppress no-op
 *      round-trips when undo/redo or external edits produce identical text.
 *   3. `currentVersion` — monotonically increasing version so stale
 *      webview messages are discarded on both sides.
 */
export class MarkdownProEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'markdownPro.editor';

  /** All currently open webview panels, used for theme broadcasting. */
  private readonly activePanels = new Set<vscode.WebviewPanel>();

  /**
   * Register this provider with VS Code and return a Disposable that
   * tears it down when the extension deactivates.
   */
  public static register(context: vscode.ExtensionContext): {
    disposable: vscode.Disposable;
    provider: MarkdownProEditorProvider;
  } {
    const provider = new MarkdownProEditorProvider(context);

    // Broadcast theme and font-size changes from settings to all open panels
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('markdownPro.theme')) {
          broadcastTheme([...provider.activePanels], getActiveTheme());
        }
        if (e.affectsConfiguration('markdownPro.fontSize')) {
          broadcastFontSize([...provider.activePanels], getActiveFontSize());
        }
        if (e.affectsConfiguration('markdownPro.lineHeight')) {
          broadcastLineHeight([...provider.activePanels], getActiveLineHeight());
        }
        if (e.affectsConfiguration('markdownPro.fontFamily')) {
          broadcastFontFamily([...provider.activePanels], getActiveFontFamily());
        }
        if (e.affectsConfiguration('markdownPro.contentWidth')) {
          broadcastContentWidth([...provider.activePanels], getActiveContentWidth());
        }
        if (e.affectsConfiguration('markdownPro.showToolbar')) {
          broadcastShowToolbar([...provider.activePanels], getActiveShowToolbar());
        }
        if (e.affectsConfiguration('markdownPro.showOutline')) {
          broadcastShowOutline([...provider.activePanels], getActiveShowOutline());
        }
        if (e.affectsConfiguration('markdownPro.showSource')) {
          broadcastShowSource([...provider.activePanels], getActiveShowSource());
        }
      }),
    );

    const disposable = vscode.window.registerCustomEditorProvider(
      MarkdownProEditorProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } },
    );

    return { disposable, provider };
  }

  /** Get all active webview panels (used by the theme command for live preview). */
  public getActivePanels(): vscode.WebviewPanel[] {
    return [...this.activePanels];
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    // --- Webview configuration ---
    // Allow the webview to load resources from the dist folder (bundled JS/CSS)
    // and the document's directory (relative image paths, etc.).
    const docDir = vscode.Uri.joinPath(document.uri, '..');
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'dist'),
        docDir,
      ],
    };

    // Step 5.1: Compute a webview-safe base URI so that relative image
    // paths (e.g. `![](./img.png)`) resolve correctly inside the webview
    // while the saved markdown keeps its original relative paths.
    const baseUri = webviewPanel.webview
      .asWebviewUri(docDir)
      .toString();

    webviewPanel.webview.html = getWebviewHtml(
      webviewPanel.webview,
      this.context.extensionUri,
      getActiveShowOutline(),
      baseUri,
    );

    // Step 5.2: Warn (dev console) if the file is very large.
    if (document.lineCount > 5000) {
      console.warn(
        `Markdown Pro: "${document.fileName}" has ${document.lineCount} lines — performance may be affected.`,
      );
    }

    // --- Triple-guard sync state ---
    interface PendingEdit {
      markdown: string;
      timer?: ReturnType<typeof setTimeout>;
    }
    const pendingEdits = new Set<PendingEdit>();
    function discardPendingEdit(edit: PendingEdit): void {
      clearTimeout(edit.timer);
      pendingEdits.delete(edit);
    }
    let currentVersion = 0;
    let lastSentContent = document.getText();
    /** Helper: post the current document text to the webview. */
    function sendToWebview(type: 'init' | 'update', markdown = document.getText()): void {
      lastSentContent = markdown;
      currentVersion++;
      webviewPanel.webview.postMessage({
        type,
        markdown,
        version: currentVersion,
      });
    }

    // --- Document → Webview sync ---
    const docChangeSubscription = vscode.workspace.onDidChangeTextDocument(
      (e) => {
        // Only react to changes in *our* document.
        if (e.document !== document || e.contentChanges.length === 0) {
          return;
        }

        const newText = document.getText();
        // Guard 1: ignore only a matching edit, not an unrelated external
        // update that happens to arrive while applyEdit is in flight.
        for (const pending of pendingEdits) {
          if (pending.markdown === newText) {
            discardPendingEdit(pending);
            return;
          }
        }

        // Guard 2: skip if content hasn't actually changed.
        if (newText === lastSentContent) {
          return;
        }

        sendToWebview('update', newText);
      },
    );

    // Track this panel for theme broadcasting
    this.activePanels.add(webviewPanel);

    // --- Webview → Document sync ---
    const messageSubscription = webviewPanel.webview.onDidReceiveMessage(
      async (msg: { type: string; markdown?: string; version?: number; flush?: boolean }) => {
        switch (msg.type) {
          case 'ready': {
            // Batch all initial state into a single message to reduce
            // serialization overhead and avoid a redundant re-render.
            const initMarkdown = document.getText();
            lastSentContent = initMarkdown;
            currentVersion++;
            webviewPanel.webview.postMessage({
              type: 'init',
              markdown: initMarkdown,
              version: currentVersion,
              theme: getActiveTheme(),
              fontSize: getActiveFontSize(),
              lineHeight: getActiveLineHeight(),
              fontFamily: getActiveFontFamily(),
              contentWidth: getActiveContentWidth(),
              showToolbar: getActiveShowToolbar(),
              showOutline: getActiveShowOutline(),
              showSource: getActiveShowSource(),
            });
            break;
          }

          case 'edit': {
            const { markdown, version } = msg;
            if (typeof markdown !== 'string' || typeof version !== 'number' ||
                !Number.isSafeInteger(version) || version < 0) return;

            // A blur/visibility flush may reach us after VS Code switches tabs.
            // Only explicit final flushes may cross that inactive-panel boundary.
            if ((!webviewPanel.visible || !webviewPanel.active) && msg.flush !== true) {
              return;
            }

            // Guard 3: discard stale messages.
            if (version <= currentVersion) {
              return;
            }

            // Keep both sides on the same monotonic clock so later text-editor
            // updates are never mistaken for stale messages.
            currentVersion = version;

            // Extra safety: no-op if content is identical.
            const previous = document.getText();
            const change = computeTextChange(previous, markdown);
            if (!change) return;

            const edit = new vscode.WorkspaceEdit();
            edit.replace(
              document.uri,
              new vscode.Range(document.positionAt(change.start), document.positionAt(change.end)),
              change.text,
            );

            const pending: PendingEdit = { markdown };
            pendingEdits.add(pending);
            lastSentContent = markdown;
            let applied = false;
            try {
              applied = await vscode.workspace.applyEdit(edit);
            } catch {
              // Both a false result and a thrown error use the recovery below.
            }
            if (!applied) {
              discardPendingEdit(pending);
              if (version === currentVersion) lastSentContent = document.getText();
              // Do not overwrite the webview's unsaved draft on failure.
              void vscode.window.showErrorMessage(
                'Markdown Pro could not apply your changes to the document. Your edited text remains in the editor. Check that the file is writable and try editing again.',
              );
            } else if (pendingEdits.has(pending)) {
              // Allow a delayed change notification, but bound retention if
              // VS Code normalized the edit or emitted no matching event.
              pending.timer = setTimeout(() => discardPendingEdit(pending), 1_000);
            }
            break;
          }
        }
      },
    );

    // --- Cleanup ---
    webviewPanel.onDidDispose(() => {
      this.activePanels.delete(webviewPanel);
      for (const pending of pendingEdits) discardPendingEdit(pending);
      docChangeSubscription.dispose();
      messageSubscription.dispose();
    });
  }
}
