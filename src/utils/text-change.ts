export interface TextChange {
  start: number;
  end: number;
  text: string;
}

/** Smallest contiguous replacement, without splitting CRLF or surrogate pairs. */
export function computeTextChange(previous: string, next: string): TextChange | null {
  if (previous === next) return null;
  let start = 0;
  const length = Math.min(previous.length, next.length);
  while (start < length && previous.charCodeAt(start) === next.charCodeAt(start)) start++;
  if (splitsPair(previous, start) || splitsPair(next, start)) start--;

  let end = previous.length;
  let nextEnd = next.length;
  while (end > start && nextEnd > start && previous.charCodeAt(end - 1) === next.charCodeAt(nextEnd - 1)) {
    end--;
    nextEnd--;
  }
  if (splitsPair(previous, end) || splitsPair(next, nextEnd)) {
    end++;
    nextEnd++;
  }
  return { start, end, text: next.slice(start, nextEnd) };
}

function splitsPair(text: string, offset: number): boolean {
  const before = text.charCodeAt(offset - 1);
  const after = text.charCodeAt(offset);
  return (before === 13 && after === 10) ||
    (before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff);
}
