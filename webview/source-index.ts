interface SourceBlock {
  start: number;
  end: number;
}

/** One bounded index for the current source, reused for caret/scroll events. */
export class SourceIndex {
  private markdown: string | undefined;
  private lines: string[] = [];
  private offsets: number[] = [];
  private rowOffsets: number[] = [];
  private charsPerRow = 0;
  blocks: SourceBlock[] = [];

  update(markdown: string): void {
    if (markdown === this.markdown) return;
    this.markdown = markdown;
    this.lines = markdown.split(/\r?\n/);
    this.offsets = [0];
    for (let i = 0; i < markdown.length; i++) {
      if (markdown.charCodeAt(i) === 10) this.offsets.push(i + 1);
    }
    this.charsPerRow = 0;
    this.blocks = [];
    let start = -1;
    let inFence = false;
    for (let line = 0; line < this.lines.length; line++) {
      if (/^\s*(```|~~~)/.test(this.lines[line])) inFence = !inFence;
      if (this.lines[line].trim() && start === -1) start = line;
      const nextIsBlank = line === this.lines.length - 1 || !this.lines[line + 1].trim();
      if (start !== -1 && !inFence && nextIsBlank) {
        this.blocks.push({ start, end: line });
        start = -1;
      }
    }
    if (!this.blocks.length) this.blocks.push({ start: 0, end: this.lines.length - 1 });
  }

  lineForOffset(offset: number): number {
    return this.floorIndex(this.offsets, offset);
  }

  blockIndexForLine(line: number): number {
    let low = 0;
    let high = this.blocks.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (this.blocks[mid].start <= line) low = mid;
      else high = mid - 1;
    }
    const block = this.blocks[low];
    const next = this.blocks[low + 1];
    if (line <= block.end || !next) return low;
    return Math.abs(next.start - line) < Math.abs(block.start - line) ? low + 1 : low;
  }

  rowsBeforeLine(line: number, charsPerRow: number): number {
    this.indexRows(charsPerRow);
    return this.rowOffsets[Math.max(0, Math.min(line, this.lines.length))];
  }

  lineForRow(row: number, charsPerRow: number): number {
    this.indexRows(charsPerRow);
    return Math.min(this.lines.length - 1, this.floorIndex(this.rowOffsets, row));
  }

  private indexRows(charsPerRow: number): void {
    charsPerRow = Math.max(1, charsPerRow);
    if (charsPerRow === this.charsPerRow) return;
    this.charsPerRow = charsPerRow;
    this.rowOffsets = [0];
    for (const line of this.lines) {
      this.rowOffsets.push(this.rowOffsets[this.rowOffsets.length - 1] + Math.max(1, Math.ceil(line.length / charsPerRow)));
    }
  }

  private floorIndex(values: number[], target: number): number {
    let low = 0;
    let high = values.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (values[mid] <= target) low = mid;
      else high = mid - 1;
    }
    return low;
  }
}
