import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

let bundle: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: `export * from './webview/mermaid-renderer'; export * from './webview/mermaid-plugin';`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    format: 'iife',
    globalName: 'mermaidTest',
    platform: 'browser',
    write: false,
  });
  bundle = result.outputFiles[0].text;
});

test.beforeEach(async ({ page }) => {
  await page.setContent('<div id="editor"></div>');
  await page.addScriptTag({ content: bundle });
});

const diagrams = {
  flowchart: 'flowchart TD\n A[Start] --> B{Ready?}\n B -->|Yes| C[Done]',
  sequence: 'sequenceDiagram\n Alice->>Bob: Hello\n Bob-->>Alice: Hi',
  class: 'classDiagram\n Animal <|-- Duck\n Animal : +int age',
  state: 'stateDiagram-v2\n [*] --> Idle\n Idle --> Running',
  er: 'erDiagram\n CUSTOMER ||--o{ ORDER : places',
  gantt: 'gantt\n title Schedule\n dateFormat YYYY-MM-DD\n section Work\n Task :a1, 2026-01-01, 3d',
  pie: 'pie title Pets\n "Dogs" : 10\n "Cats" : 20',
  mindmap: 'mindmap\n root((Project))\n  One\n  Two',
  timeline: 'timeline\n title History\n 2025 : Start\n 2026 : Launch',
  xychart: 'xychart-beta\n x-axis [jan, feb, mar]\n y-axis "Sales" 0 --> 100\n bar [10, 20, 30]',
  block: 'block-beta\n columns 2\n a["One"] b["Two"]',
  architecture: 'architecture-beta\n group api(cloud)[API]\n service db(database)[Database] in api',
  frontmatter: '---\ntitle: My diagram\nconfig:\n  theme: dark\n---\nflowchart LR\n A --> B',
  directive: '%%{init: {"theme": "dark"}}%%\nflowchart LR\n A["<b>Hello</b>"] --> B',
};

for (const [name, definition] of Object.entries(diagrams)) {
  test(`renders ${name}`, async ({ page }) => {
    const result = await page.evaluate(async (source) => {
      return (window as any).mermaidTest.renderMermaidDiagram(source, 'default');
    }, definition);
    expect(result.isError, result.svg).toBe(false);
    expect(result.svg).toContain('<svg');
  });
}

test('reports invalid syntax and can render again afterwards', async ({ page }) => {
  const results = await page.evaluate(async () => {
    const api = (window as any).mermaidTest;
    return [await api.renderMermaidDiagram('flowchart TD\n A --> [', 'default'),
      await api.renderMermaidDiagram('flowchart TD\n A --> B', 'default')];
  });
  expect(results[0].isError).toBe(true);
  expect(results[0].svg).toContain('Parse error');
  expect(results[1].isError).toBe(false);
  await expect(page.locator('[id^="dmermaid-diagram-"]')).toHaveCount(0);
});

test('renders a valid diagram exceeding the default text limit', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const source = `flowchart TD\n A["${'x'.repeat(50_001)}"] --> B`;
    return (window as any).mermaidTest.renderMermaidDiagram(source, 'default');
  });
  expect(result.isError, result.svg).toBe(false);
  expect(result.svg).not.toContain('Maximum text size');
  expect(result.svg).toContain('nodeLabel');
});

test('renders a valid diagram exceeding the default edge limit', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const source = `flowchart TD\n${'A --> B\n'.repeat(501)}`;
    return (window as any).mermaidTest.renderMermaidDiagram(source, 'default');
  });
  expect(result.isError, result.svg).toBe(false);
});

test('reports resource limits without calling them syntax errors', async ({ page }) => {
  const results = await page.evaluate(async () => {
    const api = (window as any).mermaidTest;
    return [
      await api.renderMermaidDiagram(`flowchart TD\n%% ${'x'.repeat(100_001)}`, 'default'),
      await api.renderMermaidDiagram(`flowchart TD\n${'A --> B\n'.repeat(1_001)}`, 'default'),
    ];
  });
  expect(results[0].isError).toBe(true);
  expect(results[0].svg).toContain('100,000-character limit');
  expect(results[1].isError).toBe(true);
  expect(results[1].svg).toContain('Edge limit exceeded');
  expect(results[1].svg).not.toContain('Invalid mermaid diagram syntax');
});

test('escapes parser diagnostics before inserting HTML', async ({ page }) => {
  const result = await page.evaluate(async () => {
    return (window as any).mermaidTest.renderMermaidDiagram('not-a-diagram <img src=x onerror=alert(1)>', 'default');
  });
  expect(result.isError).toBe(true);
  expect(result.svg).toContain('&lt;img');
  expect(result.svg).not.toContain('<img');
});

test('renders under the webview content security policy', async ({ page }) => {
  await page.setContent(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-test'; style-src 'unsafe-inline'; img-src data:;"><div id="editor"></div>`);
  await page.evaluate((source) => {
    const script = document.createElement('script');
    script.nonce = 'test';
    script.textContent = source;
    document.head.appendChild(script);
  }, bundle);
  const result = await page.evaluate(async () => {
    return (window as any).mermaidTest.renderMermaidDiagram('flowchart TD\n A --> B', 'default');
  });
  expect(result.isError, result.svg).toBe(false);
});

async function mountViewer(page: import('@playwright/test').Page) {
  await page.addStyleTag({ content: readFileSync('webview/styles/editor.css', 'utf8') });
  await page.evaluate(() => new Promise<void>((resolve) => {
    const api = (window as any).mermaidTest;
    api.initMermaidViewer();
    api.mermaidRenderPreview('mermaid', 'flowchart TD\n A --> B', (html: string) => {
      document.getElementById('editor')!.innerHTML = html;
      resolve();
    });
  }));
  await expect(page.locator('.mermaid-content svg')).toHaveCount(1);
}

test('zoom buttons and reset update the viewer', async ({ page }) => {
  await mountViewer(page);
  await page.getByTitle('Zoom in', { exact: true }).click();
  await expect(page.locator('.mermaid-zoom-level')).toHaveText('115%');
  await page.getByTitle('Zoom out', { exact: true }).click();
  await expect(page.locator('.mermaid-zoom-level')).toHaveText('100%');
  await page.getByTitle('Reset view').click();
  await expect(page.locator('.mermaid-content')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
});

test('theme changes re-render labels without resetting zoom', async ({ page }) => {
  await mountViewer(page);
  await page.getByTitle('Zoom in', { exact: true }).click();
  const previousId = await page.locator('.mermaid-content svg').getAttribute('id');
  await page.evaluate(async () => {
    const api = (window as any).mermaidTest;
    api.setActiveTheme('github-dark');
    await api.reRenderMermaidDiagrams();
  });
  expect(await page.locator('.mermaid-content svg').getAttribute('id')).not.toBe(previousId);
  await expect(page.locator('.mermaid-content .nodeLabel').first()).toHaveText('A');
  await expect(page.locator('.mermaid-zoom-level')).toHaveText('115%');
});

test('batches trackpad zoom and keeps the pointer anchor fixed', async ({ page }) => {
  await mountViewer(page);
  const result = await page.locator('.mermaid-canvas').evaluate(async (canvas) => {
    const content = canvas.querySelector<HTMLElement>('.mermaid-content')!;
    const rect = canvas.getBoundingClientRect();
    let mutations = 0;
    const observer = new MutationObserver((records) => { mutations += records.length; });
    observer.observe(content, { attributes: true, attributeFilter: ['style'] });
    for (let i = 0; i < 20; i++) {
      canvas.dispatchEvent(new WheelEvent('wheel', {
        deltaY: -1, clientX: rect.left + 100, clientY: rect.top + 40, cancelable: true,
      }));
    }
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    observer.disconnect();
    const matrix = new DOMMatrix(content.style.transform);
    return { mutations, scale: matrix.a, x: matrix.e, y: matrix.f };
  });
  expect(result.mutations).toBe(1);
  expect(result.scale).toBeCloseTo(Math.exp(0.04));
  expect(result.x + 100 * result.scale).toBeCloseTo(100);
  expect(result.y + 40 * result.scale).toBeCloseTo(40);
});

test('pans without changing the zoom label and stops on pointer release', async ({ page }) => {
  await mountViewer(page);
  const canvas = page.locator('.mermaid-canvas');
  const rect = (await canvas.boundingBox())!;
  await page.mouse.move(rect.x + 20, rect.y + 20);
  await page.mouse.down();
  await page.mouse.move(rect.x + 100, rect.y + 60, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator('.mermaid-content')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 80, 40)');
  await expect(page.locator('.mermaid-zoom-level')).toHaveText('100%');
  await page.mouse.move(rect.x + 150, rect.y + 80);
  await expect(page.locator('.mermaid-content')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 80, 40)');
});

test('renders only the latest pending edit and ignores stale render results', async ({ page }) => {
  const result = await build({
    stdin: {
      contents: `export * from './webview/mermaid-renderer'; export * from './webview/mermaid-plugin';`,
      resolveDir: process.cwd(),
    },
    bundle: true, format: 'iife', globalName: 'queuedMermaidTest', platform: 'browser', write: false,
    plugins: [{
      name: 'controlled-renderer',
      setup(builder) {
        builder.onLoad({ filter: /mermaid-renderer\.ts$/ }, () => ({ contents: `
          export const requests = [];
          export function resetMermaidTheme() {}
          export function renderMermaidDiagram(definition) {
            return new Promise(resolve => requests.push({ definition, finish() {
              resolve({ svg: '<svg><text>' + definition + '</text></svg>', isError: false });
            }}));
          }
        ` }));
      },
    }],
  });
  await page.addScriptTag({ content: result.outputFiles[0].text });
  await page.evaluate(() => {
    const api = (window as any).queuedMermaidTest;
    document.getElementById('editor')!.innerHTML = '<div class="milkdown-code-block"><div class="preview"></div></div>';
    api.initMermaidViewer();
    api.mermaidRenderPreview('mermaid', 'first', (html: string) => {
      document.querySelector('.preview')!.innerHTML = html;
    });
  });
  await expect.poll(() => page.evaluate(() => (window as any).queuedMermaidTest.requests.length)).toBe(1);
  for (const source of ['superseded', 'latest']) {
    await page.evaluate(definition => {
      (window as any).queuedMermaidTest.mermaidRenderPreview('mermaid', definition, (html: string) => {
        document.querySelector('.preview')!.innerHTML = html;
      });
    }, source);
  }
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => (window as any).queuedMermaidTest.requests.length)).toBe(1);
  await page.evaluate(() => (window as any).queuedMermaidTest.requests[0].finish());
  await expect.poll(() => page.evaluate(() => (window as any).queuedMermaidTest.requests.map((r: any) => r.definition))).toEqual(['first', 'latest']);
  await expect(page.locator('.mermaid-content svg')).toHaveCount(0);
  await page.evaluate(() => (window as any).queuedMermaidTest.requests[1].finish());
  await expect(page.locator('.mermaid-content')).toHaveText('latest');
  await page.evaluate(() => {
    (window as any).queuedMermaidTest.mermaidRenderPreview('mermaid', 'removed', (html: string) => {
      document.querySelector('.preview')!.innerHTML = html;
    });
  });
  await page.locator('.milkdown-code-block').evaluate(block => block.remove());
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => (window as any).queuedMermaidTest.requests.length)).toBe(2);
});
