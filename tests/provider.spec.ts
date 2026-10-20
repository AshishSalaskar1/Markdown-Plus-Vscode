import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

let providerBundle: string;
test.beforeAll(async () => {
  const result = await build({
    entryPoints: ['src/MarkdownProProvider.ts'], bundle: true, platform: 'node', format: 'cjs', write: false,
    plugins: [{ name: 'vscode-mock', setup(builder) {
      builder.onResolve({ filter: /^vscode$/ }, () => ({ path: 'vscode', namespace: 'mock' }));
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'module.exports = globalThis.__providerVscodeMock;' }));
    } }],
  });
  providerBundle = result.outputFiles[0].text;
});

async function harness(initial = 'Hello world\n') {
  const listeners = new Set<(event: any) => void>();
  const messages: any[] = [];
  const edits: any[] = [];
  const errors: string[] = [];
  let receive: (message: any) => Promise<void>;
  let dispose: () => void;
  let failure: 'false' | 'throw' | undefined;
  let gate: Promise<void> | undefined;
  let text = initial;
  let reads = 0;
  const positionAt = (offset: number) => {
    const prefix = text.slice(0, offset).split('\n');
    return { line: prefix.length - 1, character: prefix.at(-1)!.replace(/\r$/, '').length };
  };
  const offsetAt = (position: { line: number; character: number }) => {
    const lines = text.split('\n');
    return lines.slice(0, position.line).reduce((sum, line) => sum + line.length + 1, 0) + position.character;
  };
  const document = {
    uri: 'file:///test.md', fileName: 'test.md',
    get lineCount() { return text.split('\n').length; },
    getText() { reads++; return text; }, positionAt,
  };
  const emit = (contentChanges: any[] = [{}]) => {
    for (const listener of listeners) listener({ document, contentChanges });
  };
  const mock = {
    window: { showErrorMessage(message: string) { errors.push(message); return Promise.resolve(undefined); } },
    Uri: { joinPath: (uri: string, ...parts: string[]) => [uri, ...parts].join('/') },
    Range: class { constructor(public start: any, public end: any) {} },
    WorkspaceEdit: class {
      changes: any[] = [];
      replace(uri: string, range: any, value: string) { this.changes.push({ uri, range, text: value }); }
    },
    workspace: {
      getConfiguration: () => ({ get: (_key: string, fallback: any) => fallback }),
      onDidChangeTextDocument(listener: (event: any) => void) {
        listeners.add(listener);
        return { dispose: () => listeners.delete(listener) };
      },
      async applyEdit(edit: any) {
        edits.push(edit);
        const wait = gate;
        gate = undefined;
        if (wait) await wait;
        const mode = failure;
        failure = undefined;
        if (mode === 'false') return false;
        if (mode === 'throw') throw new Error('Simulated failed WorkspaceEdit');
        for (const change of edit.changes) {
          const start = offsetAt(change.range.start);
          const end = offsetAt(change.range.end);
          text = text.slice(0, start) + change.text + text.slice(end);
          emit();
        }
        return true;
      },
    },
  };
  (globalThis as any).__providerVscodeMock = mock;
  const module = { exports: {} as any };
  new Function('require', 'module', 'exports', providerBundle)(createRequire(`${process.cwd()}/package.json`), module, module.exports);
  delete (globalThis as any).__providerVscodeMock;
  const panel = {
    visible: true, active: true,
    webview: {
      options: {}, html: '', cspSource: 'test:', asWebviewUri: (uri: string) => uri,
      postMessage: (message: any) => { messages.push(message); return Promise.resolve(true); },
      onDidReceiveMessage: (listener: any) => { receive = listener; return { dispose() { receive = undefined as any; } }; },
    },
    onDidDispose: (listener: () => void) => { dispose = listener; },
  };
  const provider = new module.exports.MarkdownProEditorProvider({ extensionUri: '/extension' });
  await provider.resolveCustomTextEditor(document, panel, {});
  return {
    panel, provider, messages, edits, errors, listeners,
    text: () => text,
    reads: () => reads,
    send: (message: any) => receive(message),
    close: () => dispose(),
    failNext: (mode: 'false' | 'throw') => { failure = mode; },
    pauseNext() {
      let release!: () => void;
      gate = new Promise<void>(resolve => { release = resolve; });
      return release;
    },
    external(value: string, contentChanges = [{}]) { text = value; emit(contentChanges); },
  };
}

test('provider initializes state and applies only the changed document range without echo', async () => {
  const h = await harness();
  await h.send({ type: 'ready' });
  expect(h.messages[0]).toMatchObject({ type: 'init', version: 1, markdown: 'Hello world\n', theme: 'vscode' });
  await h.send({ type: 'edit', version: 2, markdown: 'Hello world!\n' });
  expect(h.text()).toBe('Hello world!\n');
  expect(h.edits[0].changes).toEqual([{ uri: 'file:///test.md', range: { start: { line: 0, character: 11 }, end: { line: 0, character: 11 } }, text: '!' }]);
  expect(h.messages).toHaveLength(1);
});

test('external document changes advance the clock and stale webview edits are rejected', async () => {
  const h = await harness();
  await h.send({ type: 'ready' });
  await h.send({ type: 'edit', version: 2, markdown: 'Hello world!\n' });
  const reads = h.reads();
  h.external('External\n');
  expect(h.reads() - reads).toBe(1);
  expect(h.messages.at(-1)).toEqual({ type: 'update', version: 3, markdown: 'External\n' });
  await h.send({ type: 'edit', version: 2, markdown: 'Stale\n' });
  expect(h.text()).toBe('External\n');
});

test('unchanged content and document metadata events do not generate edits or full-text reads', async () => {
  const h = await harness();
  await h.send({ type: 'ready' });
  await h.send({ type: 'edit', version: 2, markdown: 'Hello world\n' });
  expect(h.edits).toHaveLength(0);
  const reads = h.reads();
  h.external(h.text(), []);
  expect(h.reads()).toBe(reads);
  expect(h.messages).toHaveLength(1);
});

for (const mode of ['false', 'throw'] as const) {
  test(`a WorkspaceEdit ${mode === 'false' ? 'rejection' : 'exception'} does not suppress the next external update`, async () => {
    const h = await harness();
    await h.send({ type: 'ready' });
    h.failNext(mode);
    await h.send({ type: 'edit', version: 2, markdown: 'Unsaved edit\n' });
    expect(h.text()).toBe('Hello world\n');
    expect(h.errors).toHaveLength(1);
    h.external('Authoritative external change\n');
    expect(h.messages.at(-1)).toMatchObject({ type: 'update', markdown: 'Authoritative external change\n' });
  });
}

test('panel disposal releases subscriptions and removes the panel from broadcasts', async () => {
  const h = await harness();
  expect(h.provider.getActivePanels()).toEqual([h.panel]);
  expect(h.listeners.size).toBe(1);
  h.close();
  expect(h.listeners.size).toBe(0);
  expect(h.provider.getActivePanels()).toEqual([]);
});

test('an external edit is not swallowed while a WorkspaceEdit is still pending', async () => {
  const h = await harness();
  await h.send({ type: 'ready' });
  h.failNext('false');
  const release = h.pauseNext();
  const pending = h.send({ type: 'edit', version: 2, markdown: 'Pending draft\n' });
  h.external('Concurrent external change\n');
  expect(h.messages.at(-1)).toMatchObject({ type: 'update', version: 3, markdown: 'Concurrent external change\n' });
  release();
  await pending;
  await h.send({ type: 'edit', version: 4, markdown: 'Recovered edit\n' });
  expect(h.text()).toBe('Recovered edit\n');
});

test('a final flushed edit can arrive after the panel becomes inactive without accepting stale replays', async () => {
  const h = await harness();
  await h.send({ type: 'ready' });
  h.panel.active = false;
  h.panel.visible = false;
  await h.send({ type: 'edit', version: 2, markdown: 'Background synthetic update\n' });
  expect(h.edits).toHaveLength(0);
  await h.send({ type: 'edit', version: 2, markdown: 'Final user edit\n', flush: true });
  expect(h.text()).toBe('Final user edit\n');
  await h.send({ type: 'edit', version: 2, markdown: 'Replayed conflicting content\n', flush: true });
  expect(h.text()).toBe('Final user edit\n');
  expect(h.edits).toHaveLength(1);
});

test('malformed messages cannot poison the document version clock', async () => {
  const h = await harness();
  await h.send({ type: 'ready' });
  for (const message of [
    { type: 'edit', version: Number.NaN, markdown: 'Invalid' },
    { type: 'edit', version: -1, markdown: 'Invalid' },
    { type: 'edit', version: 2 },
    { type: 'edit', version: '2', markdown: 'Invalid' },
  ]) await h.send(message);
  expect(h.edits).toHaveLength(0);
  await h.send({ type: 'edit', version: 2, markdown: 'Valid\n' });
  expect(h.text()).toBe('Valid\n');
});
