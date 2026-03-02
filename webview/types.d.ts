/**
 * VS Code webview API — globally available in VS Code webview contexts.
 * @see https://code.visualstudio.com/api/extension-guides/webview#scripts-and-message-passing
 */
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};
