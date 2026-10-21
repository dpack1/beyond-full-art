const CLIP_OVERFLOW = new Set(['auto', 'hidden', 'scroll']);

export function fitJournalToVisiblePane(
    section: HTMLElement,
    host: HTMLElement,
): void {
  const limit = findClipHeight(host);
  if (limit === null) {
    section.style.removeProperty('max-height');
    return;
  }

  section.style.maxHeight = `${Math.max(limit, 160)}px`;
}

function findClipHeight(host: HTMLElement): number | null {
  let current: HTMLElement | null = host;
  let depth = 0;
  while (current !== null && depth < 8) {
    const overflowY = current.ownerDocument.defaultView
        ?.getComputedStyle(current)
        .overflowY ?? '';
    if (CLIP_OVERFLOW.has(overflowY) && current.clientHeight > 0) {
      return current.clientHeight;
    }

    current = current.parentElement;
    depth += 1;
  }

  return null;
}
