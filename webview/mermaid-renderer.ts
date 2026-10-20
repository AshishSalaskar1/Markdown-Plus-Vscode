/**
 * Mermaid diagram renderer with lazy initialization.
 *
 * Uses dynamic import() to defer mermaid's ~2.5 MB initialization
 * until a mermaid code block is first encountered. The ESM build splits
 * Mermaid and its diagram implementations into on-demand chunks.
 */

let mermaidModule: typeof import('mermaid') | null = null;
let renderCounter = 0;
let currentTheme = '';
const MAX_TEXT_SIZE = 100_000;

/**
 * Ensure mermaid is loaded and initialized with the given theme.
 * Calling initialize() again after a theme change reconfigures mermaid.
 */
async function ensureMermaid(theme: string): Promise<typeof import('mermaid')['default']> {
  if (!mermaidModule) {
    mermaidModule = await import('mermaid');
  }
  if (!mermaidModule) {
    throw new Error('Failed to load mermaid');
  }
  if (currentTheme !== theme) {
    mermaidModule.default.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      // Mermaid's defaults reject otherwise valid larger diagrams. Keep
      // bounded limits, but allow typical documentation/architecture charts.
      maxTextSize: MAX_TEXT_SIZE,
      maxEdges: 1_000,
      suppressErrorRendering: true,
      theme: theme as any,
      logLevel: 'error' as any,
    });
    currentTheme = theme;
  }
  return mermaidModule.default;
}

// Serialization queue — ensures only one mermaid.render() runs at a time,
// preventing corrupt SVG from concurrent renders with global DOM state.
let renderQueue: Promise<void> = Promise.resolve();

/**
 * Render a mermaid diagram definition to an SVG string.
 * Returns an error HTML string if the diagram is invalid.
 * Renders are serialized to prevent concurrent mermaid.render() calls.
 */
export async function renderMermaidDiagram(
  definition: string,
  theme: string,
): Promise<{ svg: string; isError: boolean }> {
  const result = renderQueue.then(async () => {
    const id = `mermaid-diagram-${++renderCounter}`;
    try {
      // Mermaid otherwise returns a "Maximum text size" SVG as a successful
      // render, rather than throwing. Report it as an actual preview error.
      if (definition.length > MAX_TEXT_SIZE) {
        throw new Error(`Diagram exceeds the ${MAX_TEXT_SIZE.toLocaleString('en-US')}-character limit.`);
      }
      const mermaid = await ensureMermaid(theme);
      const { svg } = await mermaid.render(id, definition);
      return { svg, isError: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        svg: `<div class="mermaid-error">Unable to render Mermaid diagram:\n${escapeHtml(message)}</div>`,
        isError: true,
      };
    } finally {
      // A failed render can leave Mermaid's temporary container in the editor.
      document.getElementById(`d${id}`)?.remove();
    }
  });
  // Keep the chain alive — swallow errors so future renders aren't blocked
  renderQueue = result.then(() => {}, () => {});
  return result;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

/**
 * Re-initialize mermaid with a new theme. Call this when the user
 * switches extension themes. Existing diagrams must be re-rendered
 * after calling this.
 */
export function resetMermaidTheme(): void {
  currentTheme = '';
}
