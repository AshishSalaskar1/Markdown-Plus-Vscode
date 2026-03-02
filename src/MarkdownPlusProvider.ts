import * as vscode from 'vscode';
import { getWebviewHtml } from './utils/html';
import { broadcastTheme, getActiveTheme } from './themes';

/** Read the persisted font size from configuration. */
export function getActiveFontSize(): number {
  return vscode.workspace
    .getConfiguration('markdownPlus')
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

/**
 * CustomTextEditorProvider that drives the Markdown Plus WYSIWYG editor.
 *
 * Bidirectional sync between the VS Code TextDocument and the webview uses
 * a triple-guard strategy to prevent infinite edit loops:
 *   1. `pendingEdits` — counter that tracks in-flight WorkspaceEdits so
 *      the document-change listener skips the events *we* triggered.
 *      A counter (not a boolean) handles overlapping applyEdit calls.
 *   2. `lastSentContent` — content-equality check to suppress no-op
 *      round-trips when undo/redo or external edits produce identical text.
 *   3. `currentVersion` — monotonically increasing version so stale
 *      webview messages are discarded on both sides.
 */
export class MarkdownPlusEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'markdownPlus.editor';

  /** All currently open webview panels, used for theme broadcasting. */
  private readonly activePanels = new Set<vscode.WebviewPanel>();

  /**
   * Register this provider with VS Code and return a Disposable that
   * tears it down when the extension deactivates.
   */
  public static register(context: vscode.ExtensionContext): {
    disposable: vscode.Disposable;
    provider: MarkdownPlusEditorProvider;
  } {
    const provider = new MarkdownPlusEditorProvider(context);

    // Broadcast theme and font-size changes from settings to all open panels
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('markdownPlus.theme')) {
          broadcastTheme([...provider.activePanels], getActiveTheme());
        }
        if (e.affectsConfiguration('markdownPlus.fontSize')) {
          broadcastFontSize([...provider.activePanels], getActiveFontSize());
        }
      }),
    );

    const disposable = vscode.window.registerCustomEditorProvider(
      MarkdownPlusEditorProvider.viewType,
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
      baseUri,
    );

    // Step 5.2: Warn (dev console) if the file is very large.
    if (document.lineCount > 5000) {
      console.warn(
        `Markdown Plus: "${document.fileName}" has ${document.lineCount} lines — performance may be affected.`,
      );
    }

    // --- Triple-guard sync state ---
    let pendingEdits = 0;
    let currentVersion = 0;
    let lastSentContent = document.getText();

    /** Helper: post the current document text to the webview. */
    function sendToWebview(type: 'init' | 'update'): void {
      const markdown = document.getText();
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
        if (e.document.uri.toString() !== document.uri.toString()) {
          return;
        }

        // Guard 1: skip events we triggered ourselves (counter handles
        // overlapping applyEdit calls from rapid webview edits).
        if (pendingEdits > 0) {
          pendingEdits--;
          return;
        }

        // Guard 2: skip if content hasn't actually changed.
        const newText = document.getText();
        if (newText === lastSentContent) {
          return;
        }

        sendToWebview('update');
      },
    );

    // Track this panel for theme broadcasting
    this.activePanels.add(webviewPanel);

    // --- Webview → Document sync ---
    const messageSubscription = webviewPanel.webview.onDidReceiveMessage(
      async (msg: { type: string; markdown?: string; version?: number }) => {
        switch (msg.type) {
          case 'ready':
            sendToWebview('init');
            // Send the current theme and font size to the newly opened webview
            webviewPanel.webview.postMessage({
              type: 'themeChange',
              theme: getActiveTheme(),
            });
            webviewPanel.webview.postMessage({
              type: 'fontSizeChange',
              fontSize: getActiveFontSize(),
            });
            break;

          case 'edit': {
            const { markdown, version } = msg as {
              markdown: string;
              version: number;
            };

            // Guard 3: discard stale messages.
            if (version < currentVersion) {
              return;
            }

            // Extra safety: no-op if content is identical.
            if (markdown === document.getText()) {
              return;
            }

            const edit = new vscode.WorkspaceEdit();
            edit.replace(
              document.uri,
              new vscode.Range(0, 0, document.lineCount, 0),
              markdown,
            );

            // Guard 1: increment pending-edit counter so our doc-change
            // listener skips the resulting event.
            pendingEdits++;
            lastSentContent = markdown;
            await vscode.workspace.applyEdit(edit);
            break;
          }
        }
      },
    );

    // --- Cleanup ---
    webviewPanel.onDidDispose(() => {
      this.activePanels.delete(webviewPanel);
      docChangeSubscription.dispose();
      messageSubscription.dispose();
    });
  }
}
