import { test, expect } from '@playwright/test';
import { computeTextChange } from '../src/utils/text-change';
import { SourceIndex } from '../webview/source-index';

for (const [previous, next] of [
  ['', 'hello'], ['hello', ''], ['hello', 'hello!'], ['hello', 'hallo'],
  ['line\r\nnext', 'line\nnext'], ['a\r\nb', 'a\r\nchanged'],
  ['a\nb', 'a\r\nb'], ['a😀b', 'a😁b'], ['a😀b', 'ab'],
]) {
  test(`minimal text replacement ${JSON.stringify(previous)} → ${JSON.stringify(next)}`, () => {
    const change = computeTextChange(previous, next)!;
    expect(previous.slice(0, change.start) + change.text + previous.slice(change.end)).toBe(next);
    // VS Code cannot address the middle of a CRLF sequence.
    expect(previous.slice(change.start - 1, change.start + 1)).not.toBe('\r\n');
    expect(previous.slice(change.end - 1, change.end + 1)).not.toBe('\r\n');
  });
}

test('a one-character edit in a large document replaces only that character', () => {
  const previous = 'Paragraph\n'.repeat(20_000);
  const offset = 100_003;
  const next = previous.slice(0, offset) + '!' + previous.slice(offset + 1);
  expect(computeTextChange(previous, next)).toEqual({ start: offset, end: offset + 1, text: '!' });
  expect(computeTextChange(previous, previous)).toBeNull();
});

test('source navigation reuses its index until the document changes', () => {
  const index = new SourceIndex();
  const text = '# Title\r\n\r\nParagraph with a wrapped line\r\n\r\n```text\r\na\r\n\r\nb\r\n```';
  index.update(text);
  const blocks = index.blocks;
  expect(blocks).toEqual([{ start: 0, end: 0 }, { start: 2, end: 2 }, { start: 4, end: 8 }]);
  index.update(text);
  expect(index.blocks).toBe(blocks);
  expect(index.lineForOffset(text.indexOf('Paragraph'))).toBe(2);
  expect(index.blockIndexForLine(1)).toBe(0);
  expect(index.blockIndexForLine(3)).toBe(1);
  expect(index.blockIndexForLine(6)).toBe(2);
  index.update('Changed');
  expect(index.blocks).not.toBe(blocks);
  expect(index.blocks).toEqual([{ start: 0, end: 0 }]);
});

test('wrapped row lookups match a linear reference, including width changes', () => {
  const lines = Array.from({ length: 5_000 }, (_, i) => 'x'.repeat(i % 100));
  const index = new SourceIndex();
  index.update(lines.join('\n'));
  for (const width of [40, 80, 10]) {
    let rows = 0;
    const actual: number[][] = [];
    const expected: number[][] = [];
    for (let line = 0; line < lines.length; line++) {
      const start = rows;
      rows += Math.max(1, Math.ceil(lines[line].length / width));
      actual.push([index.rowsBeforeLine(line, width), index.lineForRow(start, width), index.lineForRow(rows - 1, width)]);
      expected.push([start, line, line]);
    }
    expect(actual).toEqual(expected);
  }
});

test('minimal edits round-trip randomized Unicode and mixed newline boundaries', () => {
  let seed = 17;
  const random = (max: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % max;
  };
  const alphabet = ['a', 'b', '\n', '\r\n', '😀', '😁', '文'];
  const makeText = () => Array.from({ length: random(40) }, () => alphabet[random(alphabet.length)]).join('');
  const failures: string[] = [];
  for (let i = 0; i < 5_000; i++) {
    const previous = makeText();
    const next = makeText();
    const change = computeTextChange(previous, next);
    const actual = change ? previous.slice(0, change.start) + change.text + previous.slice(change.end) : previous;
    if (actual !== next) failures.push(JSON.stringify({ previous, next, change, actual }));
    if (change && [change.start, change.end].some(offset => previous.slice(offset - 1, offset + 1) === '\r\n')) {
      failures.push('CRLF split at an invalid VS Code position');
    }
  }
  expect(failures).toEqual([]);
});
