import {parseCharacterIdFromCharacterPageUrl} from '../../platform/dndbeyond/urls';

export const DELETE_CONFIRMATION_NOTE =
  'This also deletes the journal and photos. Export them first to keep them.';

const NOTE_ATTRIBUTE = 'data-bfa-cleanup-note';
const NOTE_STYLE_ATTRIBUTE = 'data-bfa-cleanup-inline-styles';

export function isCharacterDeleteConfirmation(element: Element): boolean {
  if (element.tagName !== 'DIALOG') {
    return false;
  }
  const text = element.textContent ?? '';
  return text.includes('Delete this character?')
    && text.includes('type the word DELETE');
}

export function characterIdFromElement(start: Element): string | null {
  let current: Element | null = start;
  for (let depth = 0; current !== null && depth < 12; depth += 1) {
    const characterId = soleCharacterId(current);
    if (characterId !== null) {
      return characterId;
    }
    current = current.parentElement;
  }
  return null;
}

export function placeDeleteConfirmationNote(
    dialog: Element,
    doc: Document,
    characterId: string,
): void {
  const existing = dialog.querySelector(`[${NOTE_ATTRIBUTE}]`);
  if (existing?.getAttribute('data-bfa-character-id') === characterId) {
    return;
  }
  existing?.remove();
  ensureNoteStyles(doc);
  const note = doc.createElement('p');
  note.className = 'bfa-cleanup-inline';
  note.setAttribute(NOTE_ATTRIBUTE, 'true');
  note.setAttribute('data-bfa-character-id', characterId);
  note.textContent = DELETE_CONFIRMATION_NOTE;
  const input = dialog.querySelector('input');
  if (input !== null) {
    input.before(note);
  } else {
    dialog.append(note);
  }
}

export function clearDeleteConfirmationNote(dialog: Element): void {
  dialog.querySelector(`[${NOTE_ATTRIBUTE}]`)?.remove();
}

function soleCharacterId(root: Element): string | null {
  const ids = new Set<string>();
  if (root instanceof HTMLAnchorElement) {
    const ownId = characterIdFromHref(root.getAttribute('href'));
    if (ownId !== null) {
      ids.add(ownId);
    }
  }
  for (const link of root.querySelectorAll('a[href*="/characters/"]')) {
    const characterId = characterIdFromHref(link.getAttribute('href'));
    if (characterId !== null) {
      ids.add(characterId);
    }
  }
  if (ids.size !== 1) {
    return null;
  }
  return [...ids][0] ?? null;
}

function characterIdFromHref(href: string | null): string | null {
  if (href === null || href.trim() === '') {
    return null;
  }
  try {
    return parseCharacterIdFromCharacterPageUrl(new URL(href, 'https://www.dndbeyond.com'));
  } catch {
    return null;
  }
}

function ensureNoteStyles(doc: Document): void {
  const head = doc.head;
  if (head === null || head.querySelector(`[${NOTE_STYLE_ATTRIBUTE}]`) !== null) {
    return;
  }
  const style = doc.createElement('style');
  style.setAttribute(NOTE_STYLE_ATTRIBUTE, 'true');
  style.textContent = [
    '.bfa-cleanup-inline {',
    'color: light-dark(#8f1d1d, #ffb4b4);',
    'font-size: 14px;',
    'font-weight: 600;',
    'line-height: 1.4;',
    'margin: 0 0 12px;',
    '}',
  ].join('');
  head.append(style);
}
