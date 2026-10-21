export type JournalFormatKind =
  | 'bold'
  | 'checkbox'
  | 'heading'
  | 'italic'
  | 'link'
  | 'list';

export interface JournalFormatResult {
  selectionEnd: number;
  selectionStart: number;
  value: string;
}

export function applyJournalFormat(
    value: string,
    selectionStart: number,
    selectionEnd: number,
    kind: JournalFormatKind,
): JournalFormatResult {
  const start = clamp(selectionStart, 0, value.length);
  const end = clamp(selectionEnd, start, value.length);
  const selected = value.slice(start, end);

  if (kind === 'bold' || kind === 'italic') {
    const marker = kind === 'bold' ? '**' : '*';
    return surround(value, start, end, marker, marker);
  }

  if (kind === 'link') {
    if (selected === '') {
      const next = `${value.slice(0, start)}[[ ]]${value.slice(end)}`;
      return {
        selectionEnd: start + 3,
        selectionStart: start + 3,
        value: next,
      };
    }

    return surround(value, start, end, '[[', ']]');
  }

  const prefix = kind === 'heading'
    ? '## '
    : kind === 'checkbox'
      ? '- [ ] '
      : '- ';
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const next = `${value.slice(0, lineStart)}${prefix}${value.slice(lineStart)}`;
  const shift = prefix.length;
  return {
    selectionEnd: end + shift,
    selectionStart: start + shift,
    value: next,
  };
}

function surround(
    value: string,
    start: number,
    end: number,
    before: string,
    after: string,
): JournalFormatResult {
  const next = `${value.slice(0, start)}${before}${value.slice(start, end)}${after}${value.slice(end)}`;
  return {
    selectionEnd: end + before.length,
    selectionStart: start + before.length,
    value: next,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
