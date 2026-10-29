import {describe, expect, it} from 'vitest';

import {mountCleanupDialog} from '../../src/features/character-deletion/cleanup-dialog';
import {runWhenDocumentReady} from '../../src/features/character-deletion/cleanup-page';

describe('character deletion cleanup dialog', () => {
  it('waits until head and body exist before mounting', () => {
    const doc = document.implementation.createHTMLDocument('characters');
    doc.head.remove();
    doc.body.remove();
    let ran = false;
    expect(() => runWhenDocumentReady(doc, () => {
      ran = true;
    })).not.toThrow();
    expect(ran).toBe(false);
    expect(() => mountCleanupDialog(doc)).not.toThrow();
  });

  it('asks to delete stored full art and can remember the choice', async () => {
    const doc = document.implementation.createHTMLDocument('characters');
    const dialog = mountCleanupDialog(doc);
    let remembered = false;
    const choice = dialog.prompt(async (value) => {
      remembered = value.decision === 'keep' && value.remember;
    });
    expect(doc.body.textContent).toContain('Delete stored full art?');
    const checkbox = doc.querySelector<HTMLInputElement>('input[type="checkbox"]');
    checkbox!.checked = true;
    clickButton(doc, 'Keep art');
    await choice;
    expect(remembered).toBe(true);
    expect(doc.querySelector('.bfa-cleanup-overlay')?.hasAttribute('hidden')).toBe(true);
  });

  it('mentions the journal and photos only when that character has them', async () => {
    const doc = document.implementation.createHTMLDocument('characters');
    const dialog = mountCleanupDialog(doc);
    const note = () => doc.querySelector('.bfa-cleanup-note');
    const without = dialog.prompt(async () => undefined);
    expect(note()?.hasAttribute('hidden')).toBe(true);
    clickButton(doc, 'Keep art');
    await without;

    const withData = dialog.prompt(async () => undefined, true);
    expect(note()?.hasAttribute('hidden')).toBe(false);
    expect(note()?.textContent).toBe(
        'This also deletes the journal and photos. Export them first to keep them.',
    );
    clickButton(doc, 'Keep art');
    await withData;

    const journalOnly = dialog.prompt(async () => undefined, {
      hasArt: false,
      hasJournalData: true,
    });
    expect(doc.body.textContent).toContain('Delete stored journal?');
    expect(note()?.textContent).toBe(
        'Export the journal first to keep the notes and photos.',
    );
    clickButton(doc, 'Keep journal');
    await journalOnly;
  });

  it('sends delete when Delete art is chosen', async () => {
    const doc = document.implementation.createHTMLDocument('characters');
    const dialog = mountCleanupDialog(doc);
    let decision = '';
    const choice = dialog.prompt(async (value) => {
      decision = `${value.decision}:${value.remember}`;
    });
    clickButton(doc, 'Delete art');
    await choice;
    expect(decision).toBe('delete:false');
  });

  it('keeps art without remembering when Escape dismisses the dialog', async () => {
    const doc = document.implementation.createHTMLDocument('characters');
    const dialog = mountCleanupDialog(doc);
    let decision = '';
    const closed = dialog.prompt(async (value) => {
      decision = `${value.decision}:${value.remember}`;
    });
    doc.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked = true;
    doc.querySelector('.bfa-cleanup-dialog')?.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      key: 'Escape',
    }));
    await closed;
    expect(decision).toBe('keep:false');
  });

  it('exports the journal without closing or choosing', async () => {
    const doc = document.implementation.createHTMLDocument('characters');
    const dialog = mountCleanupDialog(doc);
    let chose = false;
    const opened = dialog.prompt(async () => {
      chose = true;
    }, {hasArt: false, hasJournalData: true}, async () => 'Journal export downloaded.');
    const exportButton = [...doc.querySelectorAll('button')].find((button) =>
      button.textContent === 'Export');
    expect(exportButton?.hasAttribute('hidden')).toBe(false);
    clickButton(doc, 'Export');
    await Promise.resolve();
    await Promise.resolve();
    expect(chose).toBe(false);
    expect(doc.body.textContent).toContain('Journal export downloaded.');
    expect(doc.querySelector('.bfa-cleanup-overlay')?.hasAttribute('hidden')).toBe(false);
    clickButton(doc, 'Keep journal');
    await opened;
  });

  it('hides export when the character has no journal', async () => {
    const doc = document.implementation.createHTMLDocument('characters');
    const dialog = mountCleanupDialog(doc);
    const opened = dialog.prompt(async () => undefined, {
      hasArt: true,
      hasJournalData: false,
    }, async () => 'Journal export downloaded.');
    const exportButton = [...doc.querySelectorAll('button')].find((button) =>
      button.textContent === 'Export');
    expect(exportButton?.hasAttribute('hidden')).toBe(true);
    clickButton(doc, 'Keep art');
    await opened;
  });

  it('stays open and shows an error when deletion fails', async () => {
    const doc = document.implementation.createHTMLDocument('characters');
    const dialog = mountCleanupDialog(doc);
    const opened = dialog.prompt(async (choice) => {
      if (choice.decision === 'delete') {
        throw new Error('Stored full art could not be deleted.');
      }
    });
    clickButton(doc, 'Delete art');
    await Promise.resolve();
    await Promise.resolve();
    expect(doc.body.textContent).toContain('Stored full art could not be deleted.');
    expect(doc.querySelector('.bfa-cleanup-overlay')?.hasAttribute('hidden')).toBe(false);
    clickButton(doc, 'Keep art');
    await opened;
  });
});

function clickButton(doc: Document, name: string): void {
  const button = [...doc.querySelectorAll('button')].find((candidate) =>
    candidate.textContent === name);
  button?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
}
