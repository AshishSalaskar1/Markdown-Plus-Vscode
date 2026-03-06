import * as vscode from 'vscode';
import { MarkdownProEditorProvider, getActiveFontSize } from './MarkdownProProvider';
import { registerThemeCommand } from './themes';

export function activate(context: vscode.ExtensionContext): void {
  // Register the custom editor provider
  const { disposable, provider } = MarkdownProEditorProvider.register(context);
  context.subscriptions.push(disposable);

  // Register the theme picker command with live preview
  registerThemeCommand(context, () => provider.getActivePanels());

  // Register the "Open with Markdown Pro" command
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownPro.openEditor', (uri?: vscode.Uri) => {
      // Context menu provides uri; command palette falls back to active editor
      const targetUri = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (targetUri) {
        vscode.commands.executeCommand('vscode.openWith', targetUri, 'markdownPro.editor');
      }
    }),
  );

  // Register font-size adjustment commands
  const FONT_SIZE_STEP = 2;
  const DEFAULT_FONT_SIZE = 16;

  context.subscriptions.push(
    vscode.commands.registerCommand('markdownPro.increaseFontSize', () => {
      const current = getActiveFontSize();
      const next = Math.min(current + FONT_SIZE_STEP, 40);
      vscode.workspace
        .getConfiguration('markdownPro')
        .update('fontSize', next, vscode.ConfigurationTarget.Global);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('markdownPro.decreaseFontSize', () => {
      const current = getActiveFontSize();
      const next = Math.max(current - FONT_SIZE_STEP, 8);
      vscode.workspace
        .getConfiguration('markdownPro')
        .update('fontSize', next, vscode.ConfigurationTarget.Global);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('markdownPro.resetFontSize', () => {
      vscode.workspace
        .getConfiguration('markdownPro')
        .update('fontSize', DEFAULT_FONT_SIZE, vscode.ConfigurationTarget.Global);
    }),
  );

  // Register the search command — sends a message to the active webview
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownPro.search', () => {
      for (const panel of provider.getActivePanels()) {
        if (panel.active) {
          panel.webview.postMessage({ type: 'toggleSearch' });
        }
      }
    }),
  );
}

export function deactivate(): void {
  // No-op
}
