import * as vscode from 'vscode';

/** Theme metadata used by the QuickPick and settings. */
export interface ThemeDefinition {
  id: string;
  label: string;
  description: string;
}

/** All available themes. Order matches the enum in package.json. */
export const THEMES: readonly ThemeDefinition[] = [
  { id: 'vscode',           label: '$(color-mode) VS Code',           description: 'Match your VS Code editor theme' },
  { id: 'github-light',     label: '$(symbol-color) GitHub Light',    description: 'Clean light theme inspired by GitHub' },
  { id: 'github-dark',      label: '$(symbol-color) GitHub Dark',     description: "GitHub's dark color scheme" },
  { id: 'dracula',          label: '$(symbol-color) Dracula',         description: 'Popular dark theme with vibrant colors' },
  { id: 'nord',             label: '$(symbol-color) Nord',            description: 'Arctic, north-bluish palette' },
  { id: 'solarized-light',  label: '$(symbol-color) Solarized Light', description: 'Precision colors for light backgrounds' },
  { id: 'solarized-dark',   label: '$(symbol-color) Solarized Dark',  description: 'Precision colors for dark backgrounds' },
  { id: 'one-dark',         label: '$(symbol-color) One Dark',        description: "Atom's iconic dark theme" },
  { id: 'tokyo-night',      label: '$(symbol-color) Tokyo Night',     description: 'Inspired by Tokyo city lights' },
  { id: 'gruvbox-light',    label: '$(symbol-color) Gruvbox Light',   description: 'Retro groove light palette' },
  { id: 'gruvbox-dark',     label: '$(symbol-color) Gruvbox Dark',    description: 'Retro groove dark palette' },
] as const;

/** Read the persisted theme from configuration. */
export function getActiveTheme(): string {
  return vscode.workspace
    .getConfiguration('markdownPlus')
    .get<string>('theme', 'vscode');
}

interface ThemeQuickPickItem extends vscode.QuickPickItem {
  themeId: string;
}

/**
 * Register the `markdownPlus.changeTheme` command.
 *
 * Opens a QuickPick that previews themes live as the user navigates
 * with arrow keys, persists on Enter, and reverts on Escape — mirroring
 * VS Code's built-in color theme picker behavior.
 */
export function registerThemeCommand(
  context: vscode.ExtensionContext,
  getActiveWebviews: () => vscode.WebviewPanel[],
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownPlus.changeTheme', () => {
      const originalTheme = getActiveTheme();

      const items: ThemeQuickPickItem[] = THEMES.map((t) => ({
        label: t.label,
        description: t.description,
        themeId: t.id,
      }));

      const quickPick = vscode.window.createQuickPick<ThemeQuickPickItem>();
      quickPick.items = items;
      quickPick.placeholder = 'Select a theme (↑↓ to preview)';
      quickPick.matchOnDescription = true;

      // Pre-select the current theme
      const current = items.find((i) => i.themeId === originalTheme);
      if (current) {
        quickPick.activeItems = [current];
      }

      let accepted = false;
      let previewTimeout: ReturnType<typeof setTimeout> | undefined;

      // Live preview as user navigates
      quickPick.onDidChangeActive((active) => {
        if (previewTimeout) {
          clearTimeout(previewTimeout);
        }
        previewTimeout = setTimeout(() => {
          const selected = active[0];
          if (selected) {
            broadcastTheme(getActiveWebviews(), selected.themeId);
          }
        }, 150);
      });

      // Persist on Enter
      quickPick.onDidAccept(() => {
        accepted = true;
        const selected = quickPick.selectedItems[0];
        if (selected) {
          vscode.workspace
            .getConfiguration('markdownPlus')
            .update('theme', selected.themeId, vscode.ConfigurationTarget.Global);
        }
        quickPick.hide();
      });

      // Revert on Escape / dismiss
      quickPick.onDidHide(() => {
        if (previewTimeout) {
          clearTimeout(previewTimeout);
        }
        if (!accepted) {
          broadcastTheme(getActiveWebviews(), originalTheme);
        }
        quickPick.dispose();
      });

      quickPick.show();
    }),
  );
}

/** Send a theme change message to all open webview panels. */
export function broadcastTheme(
  panels: vscode.WebviewPanel[],
  themeId: string,
): void {
  for (const panel of panels) {
    panel.webview.postMessage({ type: 'themeChange', theme: themeId });
  }
}
