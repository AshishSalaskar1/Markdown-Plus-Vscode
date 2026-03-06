/**
 * Mermaid diagram renderer with lazy initialization.
 *
 * Uses dynamic import() to defer mermaid's ~2.5 MB initialization
 * until a mermaid code block is first encountered. In esbuild IIFE
 * output, this becomes an inline deferred module (no code splitting).
 */

let mermaidModule: typeof import('mermaid') | null = null;
let renderCounter = 0;
let currentTheme = 'default';

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
  if (currentTheme !== theme || renderCounter === 0) {
    mermaidModule.default.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: theme as any,
      logLevel: 'error' as any,
    });
    currentTheme = theme;
  }
  return mermaidModule.default;
}

/**
 * Render a mermaid diagram definition to an SVG string.
 * Returns an error HTML string if the diagram is invalid.
 */
export async function renderMermaidDiagram(
  definition: string,
  theme: string,
): Promise<{ svg: string; isError: boolean }> {
  const mermaid = await ensureMermaid(theme);
  const id = `mermaid-diagram-${++renderCounter}`;
  try {
    const { svg } = await mermaid.render(id, definition);
    return { svg, isError: false };
  } catch {
    return {
      svg: '<div class="mermaid-error">Invalid mermaid diagram syntax</div>',
      isError: true,
    };
  }
}

/**
 * Re-initialize mermaid with a new theme. Call this when the user
 * switches extension themes. Existing diagrams must be re-rendered
 * after calling this.
 */
export function resetMermaidTheme(): void {
  currentTheme = '';
}
