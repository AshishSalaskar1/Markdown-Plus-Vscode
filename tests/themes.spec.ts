import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { getMermaidTheme } from '../webview/mermaid-themes';

const themes: string[] = JSON.parse(readFileSync('package.json', 'utf8'))
  .contributes.configuration.properties['markdownPro.theme'].enum;
const lightThemes = new Set([
  'github-light', 'solarized-light', 'gruvbox-light', 'catppuccin-latte',
  'rose-pine-dawn', 'one-light', 'ayu-light', 'flexoki-light',
  'light-owl', 'quiet-light', 'papercolor-light', 'material-lighter', 'tokyo-night-day',
]);
const markdown = `---
title: Reading test
---

# Heading one

## Heading two

### Heading three

#### Heading four

##### Heading five

###### Heading six

Readable paragraph with **strong text**, *emphasis*, a [link](https://example.com), and \`inline code\`.

Follow this [reference link][guide], a [section link](#heading-one), or a [\`code link\`](https://example.com/code).

[guide]: https://example.com/reference

> A readable quotation with a [quoted link](https://example.com).

| Column | Value |
| --- | --- |
| Label | Content |

\`\`\`javascript
// Readable comment
const message = "Readable code block";
const count = 42;
\`\`\`
`;

async function openTheme(page: Page, theme: string, hostLight: boolean) {
  await page.addInitScript(({ theme, markdown, hostLight }) => {
    (window as any).cspViolations = [];
    document.addEventListener('securitypolicyviolation', event => {
      (window as any).cspViolations.push(event.violatedDirective);
    });
    (window as any).acquireVsCodeApi = () => {
      const root = document.documentElement;
      const colors = hostLight ? {
        background: '#ffffff', foreground: '#1f2328', muted: '#59636e', link: '#0969da', surface: '#f6f8fa',
      } : {
        background: '#1e1e1e', foreground: '#d4d4d4', muted: '#b0b0b0', link: '#75beff', surface: '#252526',
      };
      for (const [name, value] of Object.entries({
        '--vscode-editor-background': colors.background,
        '--vscode-editor-foreground': colors.foreground,
        '--vscode-descriptionForeground': colors.muted,
        '--vscode-textLink-foreground': colors.link,
        '--vscode-textCodeBlock-background': colors.surface,
        '--vscode-editorWidget-background': colors.surface,
        '--vscode-editorWidget-border': hostLight ? '#d0d7de' : '#454545',
        '--vscode-editor-font-size': '14px',
      })) root.style.setProperty(name, value);
      return { postMessage(message: any) {
        if (message.type === 'ready') window.postMessage({
          type: 'init', version: 1, markdown, theme, fontSize: 16, showSource: true, showOutline: true,
        }, '*');
      } };
    };
  }, { theme, markdown, hostLight });
  await page.goto('http://127.0.0.1:4173');
  await expect(page.locator('.ProseMirror h6')).toHaveText('Heading six');
  await expect(page.locator('.outline-item')).toHaveCount(6);
  await expect(page.locator('.cm-content .tok-keyword').first()).toBeVisible();
}

async function readingContrast(page: Page) {
  return page.evaluate(() => {
    const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    function rgba(color: string): number[] {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const values = Array.from(context.getImageData(0, 0, 1, 1).data);
      return [values[0], values[1], values[2], values[3] / 255];
    }
    function over(foreground: number[], background: number[]): number[] {
      const alpha = foreground[3] ?? 1;
      return foreground.slice(0, 3).map((value, i) => value * alpha + background[i] * (1 - alpha));
    }
    function luminance(color: number[]): number {
      const linear = color.map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    }
    const selectors = [
      '.ProseMirror h1', '.ProseMirror h2', '.ProseMirror h3', '.ProseMirror h4', '.ProseMirror h5', '.ProseMirror h6',
      '.ProseMirror > p', '.ProseMirror > p strong', '.ProseMirror > p em', '.ProseMirror > p a', '.ProseMirror > p code',
      '.ProseMirror blockquote p', '.ProseMirror blockquote a', '.ProseMirror th', '.ProseMirror td', '.cm-content', '.cm-content [class*="tok-"]',
      '#source-input', '#frontmatter-input', '.source-pane-header', '.source-pane-hint', '.frontmatter-panel-title',
      '.frontmatter-panel-hint', '.mdpro-outline-header', '.outline-item',
      '.milkdown-link-preview[data-show="true"] .link-display',
      '.milkdown-link-edit[data-show="true"] .input-area',
    ];
    return selectors.flatMap(selector => Array.from(document.querySelectorAll<HTMLElement>(selector), element => {
      const ancestors: Element[] = [];
      for (let node: Element | null = element; node; node = node.parentElement) ancestors.push(node);
      let background = [255, 255, 255];
      for (const node of ancestors.reverse()) background = over(rgba(getComputedStyle(node).backgroundColor), background);
      const style = getComputedStyle(element);
      const foreground = over(rgba(style.color), background);
      const values = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
      return { selector, text: element.textContent?.trim().slice(0, 24), ratio: (values[1] + 0.05) / (values[0] + 0.05), color: style.color, background };
    }));
  });
}

for (const theme of themes.filter(theme => theme !== 'vscode')) {
  test(`${theme}: readable Markdown and UI on an opposite-polarity VS Code host`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.stack ?? error.message));
    // A dark extension theme on a light host (and vice versa) catches leaked
    // host foreground colors in source panes, CodeMirror, and preview controls.
    await openTheme(page, theme, !lightThemes.has(theme));
    const samples = await readingContrast(page);
    const failures = samples.filter(sample => sample.ratio < 4.5)
      .map(sample => `${sample.selector} (${sample.text}): ${sample.ratio.toFixed(2)}:1`);
    expect(failures).toEqual([]);
    const sizes = await page.locator('.ProseMirror').evaluate(root => {
      const paragraph = parseFloat(getComputedStyle(root.querySelector('p')!).fontSize);
      return Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6'), heading => ({
        weight: Number(getComputedStyle(heading).fontWeight),
        relativeSize: parseFloat(getComputedStyle(heading).fontSize) / paragraph,
      }));
    });
    expect(sizes.every(heading => heading.weight >= 600 && heading.relativeSize >= 0.95)).toBe(true);
    expect(sizes.map(heading => heading.relativeSize)).toEqual([...sizes.map(heading => heading.relativeSize)].sort((a, b) => b - a));
    await expect(page.locator('.ProseMirror > p a').first()).toHaveCSS('text-decoration-line', 'underline');
    // Cover the state that previously escaped paragraph-only contrast checks:
    // hover colors and the URL/input popup live outside the document content.
    await page.locator('.ProseMirror h6').click();
    await page.locator('.ProseMirror > p a').first().hover();
    await expect(page.locator('.milkdown-link-preview[data-show="true"]')).toBeVisible();
    expect((await readingContrast(page)).filter(sample => sample.ratio < 4.5)).toEqual([]);
    await page.locator('.milkdown-link-preview[data-show="true"] .link-edit-button').click();
    await expect(page.locator('.milkdown-link-edit[data-show="true"] .input-area')).toBeVisible();
    expect((await readingContrast(page)).filter(sample => sample.ratio < 4.5)).toEqual([]);
    await page.locator('.milkdown-link-edit[data-show="true"] .input-area').press('Escape');
    if (['github-light', 'dracula', 'solarized-light', 'one-dark', 'night-owl', 'light-owl'].includes(theme)) {
      await page.screenshot({ path: test.info().outputPath('reading-theme.png'), fullPage: true });
    }
    expect(errors, 'Unhandled browser errors').toEqual([]);
    expect(await page.evaluate(() => (window as any).cspViolations)).toEqual([]);
  });
}

test('switching back to VS Code restores the host colors without custom-theme leakage', async ({ page }) => {
  await openTheme(page, 'dracula', true);
  await page.evaluate(() => window.postMessage({ type: 'themeChange', theme: 'vscode' }, '*'));
  await expect(page.locator('body')).not.toHaveAttribute('data-theme', /.+/);
  await expect(page.locator('.ProseMirror h6')).toHaveCSS('color', 'rgb(31, 35, 40)');
  await expect(page.locator('#source-input')).toHaveCSS('color', 'rgb(31, 35, 40)');
  expect((await readingContrast(page)).filter(sample => sample.ratio < 4.5)).toEqual([]);
});

test('switching custom palettes updates code colors without recreating the editor', async ({ page }) => {
  await openTheme(page, 'github-dark', true);
  await page.evaluate(() => {
    (window as any).originalCodeView = document.querySelector('.cm-content');
    (window as any).originalHeading = document.querySelector('.ProseMirror h6');
    window.postMessage({ type: 'themeChange', theme: 'github-light' }, '*');
  });
  await expect(page.locator('.ProseMirror h6')).toHaveCSS('color', 'rgb(31, 35, 40)');
  expect((await readingContrast(page)).filter(sample => sample.ratio < 4.5)).toEqual([]);
  expect(await page.evaluate(() => (window as any).originalCodeView === document.querySelector('.cm-content'))).toBe(true);
  expect(await page.evaluate(() => (window as any).originalHeading === document.querySelector('.ProseMirror h6'))).toBe(true);
});

test('the selected theme survives document replacement', async ({ page }) => {
  await openTheme(page, 'dracula', true);
  await page.evaluate(source => window.postMessage({ type: 'update', version: 100, markdown: source }, '*'), markdown.replace('Readable paragraph', 'Updated paragraph'));
  await expect(page.locator('.ProseMirror > p').first()).toContainText('Updated paragraph');
  await expect(page.locator('.ProseMirror h6')).toHaveCSS('color', 'rgb(189, 147, 249)');
  expect((await readingContrast(page)).filter(sample => sample.ratio < 4.5)).toEqual([]);
});

test('every custom theme has the correct Mermaid light/dark mapping', () => {
  for (const theme of themes.filter(theme => theme !== 'vscode')) {
    expect(getMermaidTheme(theme) === 'dark', theme).toBe(!lightThemes.has(theme));
  }
});

for (const hostLight of [true, false]) {
  test(`VS Code mode preserves ${hostLight ? 'light' : 'dark'} host contrast`, async ({ page }) => {
    await openTheme(page, 'vscode', hostLight);
    expect((await readingContrast(page)).filter(sample => sample.ratio < 4.5)).toEqual([]);
  });
}

test('VS Code high-contrast colors remain authoritative', async ({ page }) => {
  await openTheme(page, 'vscode', false);
  await page.evaluate(() => {
    document.body.classList.add('vscode-high-contrast');
    for (const [name, value] of Object.entries({
      '--vscode-editor-background': '#000000', '--vscode-editor-foreground': '#ffffff',
      '--vscode-descriptionForeground': '#ffffff', '--vscode-textCodeBlock-background': '#000000',
      '--vscode-editorWidget-background': '#000000', '--vscode-textLink-foreground': '#ffff00',
    })) document.documentElement.style.setProperty(name, value);
  });
  await expect(page.locator('.ProseMirror h6')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(page.locator('body')).toHaveCSS('color-scheme', 'dark');
  expect((await readingContrast(page)).filter(sample => sample.ratio < 4.5)).toEqual([]);
});

test('light-mode links stay readable when the host hover accent is white', async ({ page }) => {
  await openTheme(page, 'vscode', true);
  await page.evaluate(() => document.documentElement.style.setProperty('--vscode-textLink-activeForeground', '#ffffff'));
  const link = page.locator('.ProseMirror > p a').first();
  await link.hover();
  await expect(link).toHaveCSS('color', 'rgb(9, 105, 218)');
  expect((await readingContrast(page)).filter(sample => sample.ratio < 4.5)).toEqual([]);
});

test('settings and theme picker expose the same palettes, including five new dark and five light', () => {
  const metadata = readFileSync('src/themes.ts', 'utf8');
  const ids = [...metadata.matchAll(/\{\s*id:\s*'([^']+)'/g)].map(match => match[1]);
  expect(ids).toEqual(themes);
  const added = ['night-owl', 'ayu-dark', 'catppuccin-macchiato', 'rose-pine-moon', 'kanagawa-wave',
    'light-owl', 'quiet-light', 'papercolor-light', 'material-lighter', 'tokyo-night-day'];
  expect(added.every(theme => themes.includes(theme))).toBe(true);
  expect(added.filter(theme => lightThemes.has(theme))).toHaveLength(5);
  expect(added.filter(theme => !lightThemes.has(theme))).toHaveLength(5);
});
