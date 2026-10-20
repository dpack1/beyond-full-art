import {describe, expect, it} from 'vitest';

import {
  applySheetTheme,
  readSheetTheme,
} from '../../src/features/character-journal/character-journal-theme';

describe('character journal theme', () => {
  it('reads an explicit dark-mode class even when the background is light', () => {
    document.body.innerHTML = `
      <div class="ct-character-sheet ct-character-sheet--dark-mode" data-theme="dark">
        <p>Sheet text</p>
      </div>
    `;
    const sheet = document.querySelector<HTMLElement>('.ct-character-sheet');
    if (sheet === null) {
      throw new Error('Missing sheet');
    }
    sheet.style.backgroundColor = 'rgb(255, 255, 255)';
    sheet.style.color = 'rgb(243, 239, 230)';

    expect(readSheetTheme(sheet).mode).toBe('dark');
    expect(readSheetTheme(sheet).background).not.toBe('rgb(255, 255, 255)');
  });

  it('follows a light background when no appearance class is set', () => {
    document.body.innerHTML = '<section id="sheet"><p>Sheet text</p></section>';
    const sheet = document.querySelector<HTMLElement>('#sheet');
    if (sheet === null) {
      throw new Error('Missing sheet');
    }
    sheet.style.backgroundColor = 'rgb(247, 244, 239)';
    sheet.style.color = 'rgb(36, 37, 39)';

    expect(readSheetTheme(sheet).mode).toBe('light');
  });

  it('updates the section when the sheet appearance class changes', async () => {
    document.body.innerHTML = `
      <div class="ct-character-sheet" data-theme="light">
        <section id="journal"></section>
      </div>
    `;
    const sheet = document.querySelector<HTMLElement>('.ct-character-sheet');
    const journal = document.querySelector<HTMLElement>('#journal');
    if (sheet === null || journal === null) {
      throw new Error('Missing theme nodes');
    }

    applySheetTheme(journal, sheet);
    expect(journal.dataset.bfaTheme).toBe('light');

    sheet.classList.add('ct-character-sheet--dark-mode');
    sheet.dataset.theme = 'dark';
    applySheetTheme(journal, sheet);

    expect(journal.dataset.bfaTheme).toBe('dark');
    expect(journal.style.getPropertyValue('--bfa-journal-background'))
        .not.toBe('rgb(255, 255, 255)');
  });
});
