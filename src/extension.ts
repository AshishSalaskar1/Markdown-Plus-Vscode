import * as vscode from 'vscode';
import { MarkdownPlusEditorProvider, getActiveFontSize, broadcastFontSize } from './MarkdownPlusProvider';
import { registerThemeCommand } from './themes';

export function activate(context: vscode.ExtensionContext): void {
  // Register the custom editor provider
  const { disposable, provider } = MarkdownPlusEditorProvider.register(context);
  context.subscriptions.push(disposable);

  // Register the theme picker command with live preview
  registerThemeCommand(context, () => provider.getActivePanels());

  // Register the "Open with Markdown Plus" command
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownPlus.openEditor', (uri?: vscode.Uri) => {
      // Context menu provides uri; command palette falls back to active editor
      const targetUri = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (targetUri) {
        vscode.commands.executeCommand('vscode.openWith', targetUri, 'markdownPlus.editor');
      }
    }),
  );

  // Register font-size adjustment commands
  const FONT_SIZE_STEP = 2;
  const DEFAULT_FONT_SIZE = 16;

  context.subscriptions.push(
    vscode.commands.registerCommand('markdownPlus.increaseFontSize', () => {
      const current = getActiveFontSize();
      const next = Math.min(current + FONT_SIZE_STEP, 40);
      vscode.workspace
        .getConfiguration('markdownPlus')
        .update('fontSize', next, vscode.ConfigurationTarget.Global);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('markdownPlus.decreaseFontSize', () => {
      const current = getActiveFontSize();
      const next = Math.max(current - FONT_SIZE_STEP, 8);
      vscode.workspace
        .getConfiguration('markdownPlus')
        .update('fontSize', next, vscode.ConfigurationTarget.Global);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('markdownPlus.resetFontSize', () => {
      vscode.workspace
        .getConfiguration('markdownPlus')
        .update('fontSize', DEFAULT_FONT_SIZE, vscode.ConfigurationTarget.Global);
    }),
  );
}

export function deactivate(): void {
  // No-op
}
