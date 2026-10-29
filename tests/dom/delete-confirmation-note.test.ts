import {describe, expect, it} from 'vitest';

import {
  characterIdFromElement,
  clearDeleteConfirmationNote,
  DELETE_CONFIRMATION_NOTE,
  isCharacterDeleteConfirmation,
  placeDeleteConfirmationNote,
} from '../../src/features/character-deletion/delete-confirmation-note';

describe('character delete confirmation note', () => {
  it('recognizes the type-DELETE confirmation and ignores other dialogs', () => {
    const doc = document.implementation.createHTMLDocument('characters');
    const dialog = doc.createElement('dialog');
    dialog.open = true;
    dialog.innerHTML = [
      '<div id="confirm-dialog">Delete this character?</div>',
      '<span>To delete Copy of Test Character, type the word DELETE into the field below.</span>',
      '<input type="text">',
    ].join('');
    doc.body.append(dialog);
    const other = doc.createElement('dialog');
    other.textContent = 'Save this character?';
    expect(isCharacterDeleteConfirmation(dialog)).toBe(true);
    expect(isCharacterDeleteConfirmation(other)).toBe(false);
  });

  it('reads the only character id in a card and places the note once', () => {
    const doc = document.implementation.createHTMLDocument('characters');
    const card = doc.createElement('article');
    card.innerHTML = '<a href="/characters/900000003">Copy of Test Character</a><button>Delete</button>';
    doc.body.append(card);
    const button = card.querySelector('button');
    expect(characterIdFromElement(button!)).toBe('900000003');

    const dialog = doc.createElement('dialog');
    dialog.innerHTML = '<input type="text">';
    doc.body.append(dialog);
    placeDeleteConfirmationNote(dialog, doc, '900000003');
    placeDeleteConfirmationNote(dialog, doc, '900000003');
    const notes = dialog.querySelectorAll('[data-bfa-cleanup-note]');
    expect(notes).toHaveLength(1);
    expect(notes[0]?.textContent).toBe(DELETE_CONFIRMATION_NOTE);
    expect(dialog.querySelector('input')?.previousElementSibling).toBe(notes[0]);

    clearDeleteConfirmationNote(dialog);
    expect(dialog.querySelector('[data-bfa-cleanup-note]')).toBeNull();
  });

  it('does not pick a character when the page has several', () => {
    const doc = document.implementation.createHTMLDocument('characters');
    doc.body.innerHTML = [
      '<a href="/characters/900000003">One</a>',
      '<a href="/characters/169418374">Two</a>',
    ].join('');
    expect(characterIdFromElement(doc.body)).toBeNull();
  });
});
