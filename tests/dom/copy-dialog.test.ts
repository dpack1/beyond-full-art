import {describe, expect, it} from 'vitest';

import {mountCopyDialog} from '../../src/features/character-copy/copy-dialog';

describe('character copy dialog', () => {
  it('copies the journal when Copy journal is chosen', async () => {
    const doc = document.implementation.createHTMLDocument('characters');
    const dialog = mountCopyDialog(doc);
    let choice = '';
    const closed = dialog.prompt(async (value) => {
      choice = value;
    });
    expect(doc.body.textContent).toContain('Copy stored journal?');
    expect(doc.body.textContent).toContain('Deleting one does not remove the other.');
    click(doc, 'Copy journal');
    await closed;
    expect(choice).toBe('copy');
  });

  it('skips without copying when Escape closes the dialog', async () => {
    const doc = document.implementation.createHTMLDocument('characters');
    const dialog = mountCopyDialog(doc);
    let choice = '';
    const closed = dialog.prompt(async (value) => {
      choice = value;
    });
    doc.querySelector('.bfa-copy-dialog')?.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      key: 'Escape',
    }));
    await closed;
    expect(choice).toBe('skip');
  });
});

function click(doc: Document, name: string): void {
  const button = [...doc.querySelectorAll('button')].find((candidate) =>
    candidate.textContent === name);
  button?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
}
