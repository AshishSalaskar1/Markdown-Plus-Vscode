/**
 * Maps Markdown Pro extension themes to mermaid diagram themes.
 *
 * Mermaid supports 5 built-in themes: default, dark, forest, neutral, base.
 * The mapping is based on each extension theme's light/dark classification
 * and visual character.
 */

const THEME_TO_MERMAID: Record<string, string> = {
  'vscode':           'auto',
  'github-light':     'default',
  'github-dark':      'dark',
  'dracula':          'dark',
  'nord':             'neutral',
  'solarized-light':  'default',
  'solarized-dark':   'dark',
  'one-dark':         'dark',
  'tokyo-night':      'dark',
  'gruvbox-light':    'neutral',
  'gruvbox-dark':     'dark',
  'catppuccin-mocha': 'dark',
  'catppuccin-latte': 'default',
  'rose-pine':        'dark',
  'rose-pine-dawn':   'neutral',
  'monokai-pro':      'dark',
  'everforest-dark':  'forest',
};

/**
 * Determine relative luminance of a CSS color string.
 * Supports hex (#rrggbb, #rgb) and rgb() formats.
 */
function getLuminance(color: string): number {
  let r = 0, g = 0, b = 0;

  color = color.trim();
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length >= 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
  } else {
    const match = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (match) {
      r = parseInt(match[1], 10);
      g = parseInt(match[2], 10);
      b = parseInt(match[3], 10);
    }
  }

  // Relative luminance per WCAG 2.0
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Cached auto-detected mermaid theme for the 'vscode' extension theme. */
let cachedVscodeTheme: string | null = null;

/** Invalidate the cached VS Code theme detection. Call on theme change. */
export function invalidateMermaidThemeCache(): void {
  cachedVscodeTheme = null;
}

/**
 * Get the mermaid theme name for a given extension theme ID.
 * When the extension theme is 'vscode', auto-detects light/dark
 * from the VS Code editor background CSS variable.
 * The result is cached to avoid forcing style recalculation on every render.
 */
export function getMermaidTheme(extensionTheme: string): string {
  const mapped = THEME_TO_MERMAID[extensionTheme];
  if (mapped === 'auto') {
    if (cachedVscodeTheme) return cachedVscodeTheme;
    const bg = getComputedStyle(document.body)
      .getPropertyValue('--vscode-editor-background').trim();
    if (bg) {
      cachedVscodeTheme = getLuminance(bg) > 0.5 ? 'default' : 'dark';
      return cachedVscodeTheme;
    }
    return 'dark'; // fallback
  }
  return mapped ?? 'default';
}
