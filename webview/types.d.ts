/**
 * VS Code webview API — globally available in VS Code webview contexts.
 * @see https://code.visualstudio.com/api/extension-guides/webview#scripts-and-message-passing
 */
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

/**
 * CSS Custom Highlight API type declarations.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API
 */
declare class Highlight {
  constructor(...ranges: AbstractRange[]);
  add(range: AbstractRange): void;
  delete(range: AbstractRange): boolean;
  clear(): void;
  readonly size: number;
  priority: number;
}

interface HighlightRegistry {
  set(name: string, highlight: Highlight): void;
  get(name: string): Highlight | undefined;
  has(name: string): boolean;
  delete(name: string): boolean;
  clear(): void;
}

interface CSS {
  highlights: HighlightRegistry;
}
