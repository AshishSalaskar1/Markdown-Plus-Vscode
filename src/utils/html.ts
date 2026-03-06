import * as vscode from 'vscode';
import { getNonce } from './nonce';

/**
 * Build the full HTML document served inside the custom editor webview.
 *
 * CSP includes `'unsafe-inline'` for `style-src` because ProseMirror
 * (used by Milkdown) injects inline styles for cursor positioning and
 * decorations.
 */
export function getWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  baseUri?: string,
): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js'),
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview.css'),
  );

  const nonce = getNonce();
  const cspSource = webview.cspSource;

  // A <base> tag makes the browser resolve relative URLs (images, links)
  // against the document's directory URI, so `![](./img.png)` works.
  const baseTag = baseUri
    ? `<base href="${baseUri.endsWith('/') ? baseUri : baseUri + '/'}">`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  ${baseTag}
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; script-src 'nonce-${nonce}'; style-src ${cspSource} 'unsafe-inline'; font-src ${cspSource};">
  <link href="${styleUri}" rel="stylesheet" />
  <title>Markdown Pro</title>
</head>
<body>
  <div id="search-bar" class="search-bar hidden">
    <div class="search-bar-inner">
      <input id="search-input" type="text" placeholder="Find in document…" autocomplete="off" spellcheck="false" />
      <span id="search-count" class="search-count"></span>
      <button id="search-prev" class="search-btn" title="Previous match (Shift+Enter)">
        <svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
      </button>
      <button id="search-next" class="search-btn" title="Next match (Enter)">
        <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <button id="search-case" class="search-btn search-toggle" title="Match Case">
        <svg viewBox="0 0 24 24"><text x="12" y="17" font-size="14" fill="currentColor" stroke="none" text-anchor="middle" font-family="sans-serif" font-weight="600">Aa</text></svg>
      </button>
      <button id="search-close" class="search-btn" title="Close (Escape)">
        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  </div>
  <div id="toolbar"></div>
  <div id="editor"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
