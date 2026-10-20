import { test, expect, type Page } from '@playwright/test';

let runtimeErrors: string[];
test.beforeEach(({ page }) => {
  runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(error.stack ?? error.message));
});
test.afterEach(async ({ page }) => {
  expect(runtimeErrors, 'Unhandled browser errors').toEqual([]);
  expect(await page.evaluate(() => (window as any).cspViolations ?? []), 'Webview CSP violations').toEqual([]);
});

async function openEditor(page: Page, markdown = '# Title\n\nHello world\n', settings = {}) {
  await page.addInitScript(({ markdown, settings }) => {
    (window as any).sentMessages = [];
    (window as any).cspViolations = [];
    document.addEventListener('securitypolicyviolation', event => {
      (window as any).cspViolations.push(event.violatedDirective);
    });
    (window as any).acquireVsCodeApi = () => ({
      postMessage(message: any) {
        (window as any).sentMessages.push(message);
        if (message.type === 'ready') {
          window.postMessage({ type: 'init', version: 1, markdown, ...settings }, '*');
        }
      },
    });
  }, { markdown, settings });
  await page.goto('http://127.0.0.1:4173');
  await expect(page.locator('.ProseMirror')).toContainText('Hello world');
  // Let the initial asynchronous Milkdown notifications drain.
  await page.waitForTimeout(350);
}

async function lastSavedMarkdown(page: Page): Promise<string | undefined> {
  return page.evaluate(() => (window as any).sentMessages.filter((message: any) => message.type === 'edit').at(-1)?.markdown);
}

test('plain Markdown does not load Mermaid or its diagram implementations', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', request => requested.push(request.url()));
  await openEditor(page);
  expect(requested.filter(url => /mermaid|flowDiagram|sequenceDiagram/.test(url))).toEqual([]);
  const result = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter((entry) => entry.name.endsWith('.js'))
    .reduce((sum, entry) => sum + (entry as PerformanceResourceTiming).decodedBodySize, 0));
  expect(result).toBeLessThan(3_000_000);
  await test.info().attach('startup-javascript-bytes', { body: String(result), contentType: 'text/plain' });
  const styles = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter(entry => entry.name.endsWith('.css'))
    .reduce((sum, entry) => sum + (entry as PerformanceResourceTiming).decodedBodySize, 0));
  expect(styles).toBeLessThan(200_000);
});

test('Mermaid chunks load on demand under the real CSP', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openEditor(page, 'Hello world\n\n```mermaid\nflowchart TD\n A --> B\n```\n');
  await expect(page.locator('.mermaid-content svg')).toHaveCount(1);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => (window as any).cspViolations)).toEqual([]);
});

async function editMermaid(page: Page, definition: string, block = page.locator('.mermaid-block').first()) {
  const source = block.locator('.cm-content');
  await source.press('Control+a');
  await page.keyboard.insertText(definition);
  return source;
}

test('EDIT opens the existing Mermaid source and synchronizes changes live', async ({ page }) => {
  await openEditor(page, 'Hello world\n\n```mermaid\nflowchart TD\n A --> B\n```\n', { showSource: true });
  const block = page.locator('.mermaid-block');
  await expect(block.locator('.mermaid-content svg')).toHaveCount(1);
  await expect(block.locator('.codemirror-host')).toBeHidden();
  await block.getByRole('button', { name: 'EDIT', exact: true }).click();
  const source = block.getByRole('textbox', { name: 'Mermaid diagram source' });
  await expect(source).toBeVisible();
  await expect(source).toBeFocused();
  await block.getByTitle('Zoom in', { exact: true }).click();
  await page.evaluate(() => {
    (window as any).originalMermaidViewer = document.querySelector('.mermaid-viewer');
    (window as any).originalMermaidSource = document.querySelector('.mermaid-block .cm-content');
  });
  const definition = 'flowchart TD\n A[Start] --> B[Edited live]';
  await editMermaid(page, definition);
  await expect(block.locator('.mermaid-content')).toContainText('Edited live');
  await expect(page.locator('#source-input')).toHaveValue(/Hello world\n\n```mermaid\nflowchart TD\n A\[Start\] --> B\[Edited live\]\n```\n+$/);
  await expect.poll(() => page.evaluate(() => (window as any).sentMessages.filter((m: any) => m.type === 'edit').at(-1)?.markdown)).toContain('B[Edited live]');
  await expect(source).toBeFocused();
  await expect(block.locator('.mermaid-zoom-level')).toHaveText('115%');
  expect(await page.evaluate(() => (window as any).originalMermaidViewer === document.querySelector('.mermaid-viewer'))).toBe(true);
  expect(await page.evaluate(() => (window as any).originalMermaidSource === document.querySelector('.mermaid-block .cm-content'))).toBe(true);
  await block.getByRole('button', { name: 'DONE', exact: true }).click();
  await expect(block.locator('.codemirror-host')).toBeHidden();
  await block.getByRole('button', { name: 'EDIT', exact: true }).click();
  await expect(source).toContainText('B[Edited live]');
});

test('incomplete Mermaid edits sync without clearing the last valid diagram', async ({ page }) => {
  await openEditor(page, 'Hello world\n\n```mermaid\nflowchart TD\n A --> B\n```\n');
  const block = page.locator('.mermaid-block');
  await expect(block.locator('.mermaid-content svg')).toHaveCount(1);
  await block.getByRole('button', { name: 'EDIT', exact: true }).click();
  await editMermaid(page, 'flowchart TD\n A --> [');
  await expect(block.locator('.mermaid-status')).toContainText('Parse error');
  await expect(block.locator('.mermaid-content svg')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => (window as any).sentMessages.filter((m: any) => m.type === 'edit').at(-1)?.markdown)).toContain('A --> [');
  await editMermaid(page, 'flowchart TD\n A --> B[Recovered]');
  await expect(block.locator('.mermaid-content')).toContainText('Recovered');
  await expect(block.locator('.mermaid-status')).toBeEmpty();
});

test('invalid and empty diagrams can be edited from their preview', async ({ page }) => {
  await openEditor(page, 'Hello world\n\n```mermaid\nnot a diagram\n```\n\n```mermaid\n\n```\n');
  const blocks = page.locator('.mermaid-block');
  await expect(blocks).toHaveCount(2);
  await expect(blocks.first().locator('.mermaid-status')).toContainText('Unable to render');
  await expect(blocks.nth(1).locator('.mermaid-status')).toContainText('Enter Mermaid code');
  for (let index = 0; index < 2; index++) {
    const block = blocks.nth(index);
    await block.getByRole('button', { name: 'EDIT', exact: true }).click();
    await editMermaid(page, `flowchart LR\n A --> B[Diagram ${index}]`, block);
    await expect(block.locator('.mermaid-content')).toContainText(`Diagram ${index}`);
  }
});

test('editing one of two identical diagrams updates only that fenced block', async ({ page }) => {
  const original = 'flowchart LR\n A --> B';
  await openEditor(page, `Hello world\n\n\`\`\`mermaid\n${original}\n\`\`\`\n\nBetween diagrams\n\n\`\`\`mermaid\n${original}\n\`\`\`\n`);
  const blocks = page.locator('.mermaid-block');
  await expect(blocks.locator('.mermaid-content svg')).toHaveCount(2);
  await blocks.nth(1).getByRole('button', { name: 'EDIT', exact: true }).click();
  await editMermaid(page, 'flowchart LR\n A --> B[Second only]', blocks.nth(1));
  await blocks.nth(1).getByRole('button', { name: 'DONE', exact: true }).click();
  await expect(blocks.nth(1).locator('.mermaid-content')).toContainText('Second only');
  await expect(blocks.first().locator('.mermaid-content')).not.toContainText('Second only');
  await expect(blocks.first().locator('.codemirror-host')).toBeHidden();
  await expect.poll(() => page.evaluate(() => (window as any).sentMessages.filter((m: any) => m.type === 'edit').at(-1)?.markdown)).toMatch(/A --> B\n```[\s\S]*Between diagrams[\s\S]*B\[Second only\]/);
});

test('Mermaid source undo and redo update both diagram and saved Markdown', async ({ page }) => {
  await openEditor(page, 'Hello world\n\n```mermaid\nflowchart TD\n A --> B\n```\n');
  const block = page.locator('.mermaid-block');
  await expect(block.locator('.mermaid-content svg')).toHaveCount(1);
  await block.getByRole('button', { name: 'EDIT', exact: true }).click();
  const source = await editMermaid(page, 'flowchart TD\n A --> B[Changed]');
  await expect(block.locator('.mermaid-content')).toContainText('Changed');
  await source.press('Control+z');
  await expect(block.locator('.mermaid-content')).not.toContainText('Changed');
  await expect.poll(() => page.evaluate(() => (window as any).sentMessages.filter((m: any) => m.type === 'edit').at(-1)?.markdown)).not.toContain('B[Changed]');
  await source.press('Control+y');
  await expect(block.locator('.mermaid-content')).toContainText('Changed');
  await expect.poll(() => page.evaluate(() => (window as any).sentMessages.filter((m: any) => m.type === 'edit').at(-1)?.markdown)).toContain('B[Changed]');
});

test('Mermaid rendering is debounced during typing and preserves the source caret', async ({ page }) => {
  await openEditor(page, 'Hello world\n\n```mermaid\nflowchart TD\n A --> B\n```\n');
  const block = page.locator('.mermaid-block');
  await expect(block.locator('.mermaid-content svg')).toHaveCount(1);
  await block.getByRole('button', { name: 'EDIT', exact: true }).click();
  const source = block.locator('.cm-content');
  await source.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.insertText('%% ');
  await page.evaluate(() => {
    (window as any).diagramRenderCount = 0;
    new MutationObserver(records => { (window as any).diagramRenderCount += records.length; })
      .observe(document.querySelector('.mermaid-content')!, { childList: true });
  });
  await page.keyboard.type('A comment typed gradually', { delay: 15 });
  await expect.poll(() => page.evaluate(() => (window as any).diagramRenderCount)).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as any).diagramRenderCount)).toBeLessThan(3);
  await expect(source).toBeFocused();
  await page.keyboard.type(' at the caret');
  await expect(source).toContainText('A comment typed gradually at the caret');
});

test('clearing Mermaid source keeps EDIT available and syncs an empty fence', async ({ page }) => {
  await openEditor(page, 'Hello world\n\n```mermaid\nflowchart TD\n A --> B\n```\n');
  const block = page.locator('.mermaid-block');
  await expect(block.locator('.mermaid-content svg')).toHaveCount(1);
  await block.getByRole('button', { name: 'EDIT', exact: true }).click();
  const source = block.locator('.cm-content');
  await source.press('Control+a');
  await source.press('Backspace');
  await expect(block.locator('.mermaid-status')).toContainText('Enter Mermaid code');
  await expect(block.locator('.mermaid-content svg')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as any).sentMessages.filter((m: any) => m.type === 'edit').at(-1)?.markdown)).toMatch(/```mermaid\n\s*```/);
  await editMermaid(page, 'flowchart TD\n A --> B[Restored]');
  await expect(block.locator('.mermaid-content')).toContainText('Restored');
});

test('external source updates appear in an open Mermaid editor', async ({ page }) => {
  await openEditor(page, 'Hello world\n\n```mermaid\nflowchart TD\n A --> B\n```\n');
  const block = page.locator('.mermaid-block');
  await expect(block.locator('.mermaid-content svg')).toHaveCount(1);
  await block.getByRole('button', { name: 'EDIT', exact: true }).click();
  await page.evaluate(() => window.postMessage({
    type: 'update', version: 1000,
    markdown: 'Hello world\n\n```mermaid\nflowchart TD\n A --> B[External update]\n```\n',
  }, '*'));
  await expect(block.locator('.cm-content')).toContainText('External update');
  await expect(block.locator('.mermaid-content')).toContainText('External update');
  await expect(block.getByRole('button', { name: 'DONE', exact: true })).toBeVisible();
});

test('switching from the raw source pane to Mermaid editing syncs without waiting', async ({ page }) => {
  await openEditor(page, 'Hello world\n\n```mermaid\nflowchart TD\n A --> B\n```\n', { showSource: true });
  const block = page.locator('.mermaid-block');
  await expect(block.locator('.mermaid-content svg')).toHaveCount(1);
  await page.locator('#source-input').fill('Hello world\n\n```mermaid\nflowchart TD\n A --> B[From source]\n```\n');
  await expect(block.locator('.cm-content')).toContainText('From source');
  await block.getByRole('button', { name: 'EDIT', exact: true }).click();
  await editMermaid(page, 'flowchart TD\n A --> B[From preview]');
  await expect(page.locator('#source-input')).toHaveValue(/B\[From preview\]/);
  await expect.poll(() => page.evaluate(() => (window as any).sentMessages.filter((m: any) => m.type === 'edit').at(-1)?.markdown)).toContain('B[From preview]');
});

test('changing a Mermaid block to another language restores the normal code editor', async ({ page }) => {
  await openEditor(page, 'Hello world\n\n```mermaid\nflowchart TD\n A --> B\n```\n');
  await expect(page.locator('.mermaid-content svg')).toHaveCount(1);
  await page.evaluate(() => window.postMessage({
    type: 'update', version: 1000, markdown: 'Hello world\n\n```javascript\nconst answer = 42;\n```\n',
  }, '*'));
  await expect(page.locator('.mermaid-viewer')).toHaveCount(0);
  await expect(page.locator('.mermaid-block')).toHaveCount(0);
  await expect(page.locator('.codemirror-host')).toBeVisible();
  await expect(page.locator('.cm-content')).toContainText('const answer = 42;');
});

test('Mermaid source and preview stack on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await openEditor(page, 'Hello world\n\n```mermaid\nflowchart TD\n A --> B\n```\n');
  const block = page.locator('.mermaid-block');
  await expect(block.locator('.mermaid-content svg')).toHaveCount(1);
  await block.getByRole('button', { name: 'EDIT', exact: true }).click();
  const source = (await block.locator('.codemirror-host').boundingBox())!;
  const preview = (await block.locator('.preview-panel').boundingBox())!;
  expect(preview.y).toBeGreaterThanOrEqual(source.y + source.height);
  expect(preview.width).toBeGreaterThan(200);
});

test('math fonts load as external assets under the real CSP', async ({ page }) => {
  const fonts: string[] = [];
  page.on('request', request => { if (request.url().endsWith('.woff2')) fonts.push(request.url()); });
  await openEditor(page, 'Hello world\n\n$$\nx^2 + y^2 = z^2\n$$\n');
  await expect(page.locator('.katex')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(fonts.length).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as any).cspViolations)).toEqual([]);
});

test('code language chunks load under the real CSP', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openEditor(page, 'Hello world\n\n```python\ndef greet():\n    return "hello"\n```\n');
  await expect(page.locator('.cm-editor')).toContainText('def greet():');
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => (window as any).cspViolations)).toEqual([]);
});

test('rich edits sync once after a typing burst and refresh hidden source on demand', async ({ page }) => {
  await openEditor(page);
  const paragraph = page.locator('.ProseMirror > p');
  await paragraph.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' and more text', { delay: 20 });
  await expect.poll(() => page.evaluate(() => (window as any).sentMessages.filter((m: any) => m.type === 'edit').length)).toBe(1);
  const markdown = await page.evaluate(() => (window as any).sentMessages.find((m: any) => m.type === 'edit').markdown);
  expect(markdown).toContain('Hello world and more text');
  await expect(page.locator('#source-input')).toHaveValue('# Title\n\nHello world\n');
  await page.locator('.toolbar-source-btn').click();
  await expect(page.locator('#source-input')).toHaveValue(markdown);
});

test('hidden outline is not rebuilt and catches up when opened', async ({ page }) => {
  await openEditor(page);
  await expect(page.locator('#outline-list')).toBeEmpty();
  await page.locator('.ProseMirror h1').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' updated');
  await page.waitForTimeout(650);
  await expect(page.locator('#outline-list')).toBeEmpty();
  await page.locator('.toolbar-outline-btn').click();
  await expect(page.locator('.outline-item')).toHaveText('Title updated');
});

test('source edits preserve raw syntax and rich editing continues afterwards', async ({ page }) => {
  await openEditor(page, '# Title\n\nHello world\n', { showSource: true });
  const source = page.locator('#source-input');
  const markdown = '# Title\n\nHello world from source\n\n<!-- preserve this comment -->\n';
  await source.fill(markdown);
  await expect(page.locator('.ProseMirror')).toContainText('Hello world from source');
  await expect(source).toHaveValue(markdown);
  await page.locator('.ProseMirror > p').first().click();
  // The source pane's authority window intentionally lasts one second.
  await page.waitForTimeout(1_100);
  await page.keyboard.press('End');
  await page.keyboard.type(' edited');
  await expect(source).toHaveValue(/Hello world from source edited/);
});

test('blur flushes the latest rich edit before Milkdown notifications arrive', async ({ page }) => {
  await openEditor(page);
  await page.locator('.ProseMirror > p').click();
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const messages = await page.evaluate(() => (window as any).sentMessages.filter((message: any) => message.type === 'edit'));
  expect(messages).toHaveLength(1);
  expect(messages[0].markdown).toContain('Hello world!');
});

test('undo and redo still synchronize rich edits', async ({ page }) => {
  await openEditor(page);
  const paragraph = page.locator('.ProseMirror > p');
  await paragraph.click();
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await expect.poll(() => page.evaluate(() => (window as any).sentMessages.filter((message: any) => message.type === 'edit').length)).toBe(1);
  await page.keyboard.press('Control+z');
  await expect(paragraph).toHaveText('Hello world');
  await expect.poll(() => page.evaluate(() => (window as any).sentMessages.filter((message: any) => message.type === 'edit').at(-1)?.markdown)).toBe('# Title\n\nHello world\n');
  await page.keyboard.press('Control+Shift+z');
  await expect(paragraph).toHaveText('Hello world!');
  await expect.poll(() => page.evaluate(() => (window as any).sentMessages.filter((message: any) => message.type === 'edit').at(-1)?.markdown)).toBe('# Title\n\nHello world!\n');
});

test('frontmatter and CRLF are preserved when serializing a rich edit', async ({ page }) => {
  await openEditor(page, '---\r\ntitle: Example\r\n---\r\n\r\nHello world\r\n');
  await page.locator('.ProseMirror > p').click();
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await expect.poll(() => page.evaluate(() => (window as any).sentMessages.filter((message: any) => message.type === 'edit').length)).toBe(1);
  const markdown = await page.evaluate(() => (window as any).sentMessages.find((message: any) => message.type === 'edit').markdown);
  expect(markdown).toMatch(/^---\r\ntitle: Example\r\n---\r\n/);
  expect(markdown).toContain('Hello world!\r\n');
  expect(markdown.replace(/\r\n/g, '')).not.toContain('\n');
});

for (const [name, handleId, property] of [
  ['source', 'source-resize', '--mdpro-source-width'],
  ['outline', 'outline-resize', '--mdpro-outline-width'],
]) {
  test(`${name} resizing batches pointer events into a single layout update`, async ({ page }) => {
    await openEditor(page, '# Title\n\nHello world\n', { showSource: true, showOutline: true });
    const handle = page.locator(`#${handleId}`);
    const rect = (await handle.boundingBox())!;
    const x = rect.x + rect.width / 2;
    await page.mouse.move(x, rect.y + 30);
    await page.mouse.down();
    const result = await page.evaluate(async ({ x, property }) => {
      let mutations = 0;
      const root = document.documentElement;
      const observer = new MutationObserver(records => { mutations += records.length; });
      observer.observe(root, { attributes: true, attributeFilter: ['style'] });
      for (let i = 1; i <= 20; i++) {
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: x - i * 3, pointerId: 1 }));
      }
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      observer.disconnect();
      return { mutations, width: root.style.getPropertyValue(property) };
    }, { x, property });
    expect(result.mutations).toBe(1);
    expect(parseFloat(result.width)).toBeGreaterThan(0);
    await page.mouse.up();
    await expect(handle).not.toHaveClass(/dragging/);
  });
}

test('formatting toolbar still updates rich content and saved Markdown', async ({ page }) => {
  await openEditor(page);
  const paragraph = page.locator('.ProseMirror > p');
  await paragraph.click();
  await page.keyboard.press('Home');
  await page.keyboard.press('Control+Shift+End');
  await page.getByRole('button', { name: 'Bold (Ctrl+B)', exact: true }).click();
  await expect(paragraph.locator('strong')).toHaveText('Hello world');
  await expect.poll(() => lastSavedMarkdown(page)).toContain('**Hello world**');
});

test('table cell edits are saved instead of restoring the original cell text', async ({ page }) => {
  await openEditor(page, 'Hello world\n\n| Name | Value |\n| --- | --- |\n| Original | 42 |\n', { showSource: true });
  const cell = page.locator('.ProseMirror td').first();
  await cell.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' changed');
  await expect(cell).toContainText('Original changed');
  await expect.poll(() => lastSavedMarkdown(page)).toContain('Original changed');
  await expect(page.locator('#source-input')).toHaveValue(/Original changed/);
});

test('editing prose preserves unrelated table formatting and list markers', async ({ page }) => {
  const table = '|Name|Value|\n|:---|---:|\n|Keep spacing|42|';
  await openEditor(page, `Hello world\n\n${table}\n\n+ First item\n+ Second item\n`);
  await page.locator('.ProseMirror > p').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await expect.poll(() => lastSavedMarkdown(page)).toContain('Hello world!');
  const saved = (await lastSavedMarkdown(page))!;
  expect(saved).toContain(table);
  expect(saved).toContain('+ First item');
  expect(saved).toContain('+ Second item');
});

test('task-checkbox clicks are synchronized without requiring a later keystroke', async ({ page }) => {
  await openEditor(page, 'Hello world\n\n- [ ] Pending task\n- [x] Completed task\n');
  const checkbox = page.locator('.label.unchecked').first();
  await checkbox.click();
  await expect(page.locator('.label.checked')).toHaveCount(2);
  await expect.poll(() => lastSavedMarkdown(page)).toContain('[x] Pending task');
});

test('search, case sensitivity, match navigation, and closing do not edit the document', async ({ page }) => {
  await openEditor(page, 'Hello world\n\nhello again\n');
  await page.evaluate(() => window.postMessage({ type: 'toggleSearch' }, '*'));
  await page.getByPlaceholder('Find in document…').fill('Hello');
  await expect(page.locator('#search-count')).toHaveText('1 of 2');
  await page.getByPlaceholder('Find in document…').press('Enter');
  await expect(page.locator('#search-count')).toHaveText('2 of 2');
  await page.getByTitle('Match Case', { exact: true }).click();
  await expect(page.locator('#search-count')).toHaveText('1 of 1');
  await page.getByPlaceholder('Find in document…').press('Escape');
  await expect(page.locator('#search-bar')).toHaveClass(/hidden/);
  expect(await lastSavedMarkdown(page)).toBeUndefined();
});

test('relative images still resolve locally and retain relative paths when saved', async ({ page }) => {
  await page.route('**/docs/images/pixel.svg', route => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="blue"/></svg>',
  }));
  await openEditor(page, 'Hello world\n\n![Example](images/pixel.svg)\n');
  const image = page.getByRole('img', { name: 'Example', exact: true });
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(20);
  expect(await image.evaluate((element: HTMLImageElement) => element.src)).toBe('http://127.0.0.1:4173/docs/images/pixel.svg');
  await page.locator('.ProseMirror > p').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await expect.poll(() => lastSavedMarkdown(page)).toContain('![Example](images/pixel.svg)');
});

test('font, layout, visibility, and theme settings never mutate Markdown', async ({ page }) => {
  await openEditor(page);
  await page.evaluate(() => {
    for (const message of [
      { type: 'fontSizeChange', fontSize: 20 }, { type: 'lineHeightChange', lineHeight: 1.8 },
      { type: 'fontFamilyChange', fontFamily: 'Georgia, serif' }, { type: 'contentWidthChange', contentWidth: 900 },
      { type: 'showToolbarChange', showToolbar: false }, { type: 'showOutlineChange', showOutline: true },
      { type: 'showSourceChange', showSource: true }, { type: 'themeChange', theme: 'quiet-light' },
    ]) window.postMessage(message, '*');
  });
  await expect(page.locator('#toolbar')).toBeHidden();
  await expect(page.locator('#source-pane')).toBeVisible();
  await expect(page.locator('.outline-item')).toHaveText('Title');
  await expect(page.locator('.ProseMirror > p')).toHaveCSS('line-height', '36px');
  await expect(page.locator('#source-input')).toHaveValue('# Title\n\nHello world\n');
  expect(await lastSavedMarkdown(page)).toBeUndefined();
});

test('frontmatter edits preserve the rendered body and update the source pane', async ({ page }) => {
  await openEditor(page, '---\ntitle: Original\n---\n\nHello world\n', { showSource: true });
  await page.locator('#frontmatter-input').fill('---\ntitle: Changed\n---');
  await expect.poll(() => lastSavedMarkdown(page)).toContain('title: Changed');
  await expect(page.locator('.ProseMirror > p')).toHaveText('Hello world');
  await expect(page.locator('#source-input')).toHaveValue('---\ntitle: Changed\n---\n\nHello world\n');
});

test('frontmatter-only changes preserve unsupported body syntax byte-for-byte', async ({ page }) => {
  const body = '\n\nHello world\n\n<!-- keep this exact comment -->\n\n:::custom-widget\n<Widget attr="unchanged" />\n:::\n';
  await openEditor(page, `---\ntitle: Original\n---${body}`, { showSource: true });
  await page.locator('#frontmatter-input').fill('---\ntitle: Changed\n---');
  await expect.poll(() => lastSavedMarkdown(page)).toBe(`---\ntitle: Changed\n---${body}`);
});

test('an external update cancels pending source edits before the next rich edit', async ({ page }) => {
  await openEditor(page, 'Hello world\n', { showSource: true });
  await page.locator('#source-input').fill('Hello world from an obsolete source edit\n');
  await page.evaluate(() => window.postMessage({ type: 'update', version: 100, markdown: 'Hello world from external\n' }, '*'));
  await expect(page.locator('.ProseMirror > p')).toHaveText('Hello world from external');
  await page.locator('.ProseMirror > p').click();
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await expect.poll(() => lastSavedMarkdown(page)).toContain('Hello world from external!');
  await expect(page.locator('#source-input')).toHaveValue(/Hello world from external!/);
});

test('stale incoming versions cannot overwrite a local edit', async ({ page }) => {
  await openEditor(page);
  await page.locator('.ProseMirror > p').click();
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await expect.poll(() => lastSavedMarkdown(page)).toContain('Hello world!');
  await page.evaluate(() => window.postMessage({ type: 'update', version: 1, markdown: '# Old\n\nStale content\n' }, '*'));
  await page.waitForTimeout(250);
  await expect(page.locator('.ProseMirror > p')).toHaveText('Hello world!');
});

test('a rich edit in a file without a final newline does not add one', async ({ page }) => {
  await openEditor(page, 'Hello world');
  await page.locator('.ProseMirror > p').click();
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await expect.poll(() => lastSavedMarkdown(page)).toBe('Hello world!');
});

test('formatting a stored mark without typing does not rewrite the Markdown on blur', async ({ page }) => {
  await openEditor(page, '---\ntitle: Keep formatting\n---\n\nHello world\n');
  await page.locator('.ProseMirror > p').click();
  await page.keyboard.press('End');
  await page.keyboard.press('Control+b');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  expect(await lastSavedMarkdown(page)).toBeUndefined();
});

test('blur marks the final pending edit for delivery after a tab switch', async ({ page }) => {
  await openEditor(page);
  await page.locator('.ProseMirror > p').click();
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const finalEdit = await page.evaluate(() => (window as any).sentMessages.filter((message: any) => message.type === 'edit').at(-1));
  expect(finalEdit).toMatchObject({ markdown: '# Title\n\nHello world!\n', flush: true });
});

test('an edit posted just before blur is flushed once even if its acknowledgement is delayed', async ({ page }) => {
  await openEditor(page);
  await page.locator('.ProseMirror > p').click();
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await expect.poll(() => lastSavedMarkdown(page)).toContain('Hello world!');
  await page.evaluate(() => {
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('blur'));
  });
  const edits = await page.evaluate(() => (window as any).sentMessages.filter((message: any) => message.type === 'edit'));
  expect(edits).toHaveLength(2);
  expect(edits[1]).toMatchObject({ version: edits[0].version, markdown: edits[0].markdown, flush: true });
});

test('switching from source to rich editing before debounce preserves both edits', async ({ page }) => {
  await openEditor(page, 'Hello world\n', { showSource: true });
  await page.locator('#source-input').fill('Hello world from source\n');
  await page.locator('.ProseMirror > p').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' and rich');
  await expect.poll(() => lastSavedMarkdown(page)).toContain('Hello world from source and rich');
  await expect(page.locator('.ProseMirror > p')).toHaveText('Hello world from source and rich');
});

test('regular highlighted code blocks remain editable and synchronize their source', async ({ page }) => {
  await openEditor(page, 'Hello world\n\n```javascript\nconst first = 1;\n```\n', { theme: 'light-owl' });
  const code = page.locator('.cm-content');
  await code.click();
  await code.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.insertText('const second = 2;');
  await expect(code.locator('.tok-keyword')).toHaveCount(2);
  await expect.poll(() => lastSavedMarkdown(page)).toContain('const first = 1;\nconst second = 2;');
});

test('Tab and Shift+Tab still navigate between table cells', async ({ page }) => {
  await openEditor(page, 'Hello world\n\n| Name | Value |\n| --- | --- |\n| Original | 42 |\n');
  await page.locator('.ProseMirror td').first().click();
  await page.keyboard.press('End');
  await page.keyboard.press('Tab');
  await expect.poll(() => page.evaluate(() => document.getSelection()?.anchorNode?.parentElement?.closest('td')?.textContent)).toBe('42');
  await page.keyboard.press('Shift+Tab');
  await expect.poll(() => page.evaluate(() => document.getSelection()?.anchorNode?.parentElement?.closest('td')?.textContent)).toBe('Original');
  await page.keyboard.press('End');
  await page.keyboard.type(' updated');
  await expect.poll(() => lastSavedMarkdown(page)).toContain('Original updated');
});

test('the table add-row button saves a new row without requiring typing', async ({ page }) => {
  await openEditor(page, 'Hello world\n\n| Name | Value |\n| --- | --- |\n| Original | 42 |\n');
  const cell = (await page.locator('.ProseMirror td').last().boundingBox())!;
  await page.mouse.move(cell.x + cell.width / 2, cell.y + cell.height - 2);
  const button = page.locator('[data-role="x-line-drag-handle"][data-show="true"] .add-button');
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.locator('.ProseMirror td')).toHaveCount(4);
  await expect.poll(async () => (await lastSavedMarkdown(page))?.split('\n').filter(line => line.trim().startsWith('|')).length).toBe(4);
});
