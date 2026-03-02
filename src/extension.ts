import * as vscode from 'vscode';
import { MarkdownPlusEditorProvider } from './MarkdownPlusProvider';

export function activate(context: vscode.ExtensionContext): void {
  // Register the custom editor provider
  context.subscriptions.push(MarkdownPlusEditorProvider.register(context));

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
}

export function deactivate(): void {
  // No-op
}
