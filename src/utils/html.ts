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
  <title>Markdown Plus</title>
</head>
<body>
  <div id="toolbar"></div>
  <div id="editor"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
