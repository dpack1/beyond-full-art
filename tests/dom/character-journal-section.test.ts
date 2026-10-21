import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {createCharacterJournalSection} from '../../src/features/character-journal/character-journal-section';
import type {CharacterJournalService} from '../../src/features/character-journal/character-journal-service';
import {colorsContrast} from '../../src/features/character-journal/character-journal-theme';
import type {JournalNote} from '../../src/features/character-journal/character-journal-types';

describe('character journal section', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="ct-character-sheet" data-theme="light">
        <button id="journal-tab" type="button">Journal</button>
        <section id="content-host">
          <div id="native-panel">Native sheet panel</div>
        </section>
      </div>
    `;
    document.head.querySelector('[data-bfa-character-journal-styles]')?.remove();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.head.querySelector('[data-bfa-character-journal-styles]')?.remove();
    vi.restoreAllMocks();
  });

  it('shows the list in the content host and says there are no notes', async () => {
    const section = createCharacterJournalSection(createFakeService([]));
    await showSection(section);

    expect(getContentHost().querySelector('.bfa-character-journal-section')).not.toBeNull();
    expect(getNativePanel().hidden).toBe(true);
    expect(document.querySelector('.bfa-journal-message')?.textContent).toBe('No notes');
    expect(document.querySelector('[data-bfa-journal-panel]')).not.toBeNull();
    expect(document.querySelector('.ct-sidebar')).toBeNull();

    section.hide();
    expect(getNativePanel().hidden).toBe(false);
    section.destroy();
  });

  it('filters rows by the search query', async () => {
    const section = createCharacterJournalSection(createFakeService([
      note({body: 'A locked door under the chapel.', id: 'door', title: 'Locked door'}),
      note({body: 'Bought rope.', id: 'market', title: 'Market day'}),
    ]));
    await showSection(section);

    const search = document.querySelector<HTMLInputElement>('.bfa-journal-search');
    if (search === null) {
      throw new Error('Missing search');
    }
    search.value = 'chapel';
    search.dispatchEvent(new Event('input'));

    expect(titles()).toEqual(['Locked door']);
    search.value = 'nope';
    search.dispatchEvent(new Event('input'));
    expect(document.querySelector('.bfa-journal-message')?.textContent).toBe('No matches');
    section.destroy();
  });

  it('keeps a dirty note when leaving is cancelled, and discard closes it', async () => {
    let hidden = false;
    let cancelled = false;
    const section = createCharacterJournalSection(createFakeService([]));
    await showSection(section);
    openNewSession();
    const title = titleField();
    title.value = 'Unsaved title';
    title.dispatchEvent(new Event('input'));

    section.requestHide(() => {
      hidden = true;
    }, () => {
      cancelled = true;
    });

    const confirm = document.querySelector('.bfa-journal-confirm');
    expect(confirm?.textContent).toContain('This note is not saved yet.');
    expect(document.activeElement).toBe(buttonNamed('Keep editing'));
    buttonNamed('Keep editing')?.click();
    expect(section.isShown()).toBe(true);
    expect(hidden).toBe(false);
    expect(cancelled).toBe(true);
    expect(titleField().value).toBe('Unsaved title');

    section.requestHide();
    buttonNamed('Discard')?.click();
    expect(section.isShown()).toBe(false);
    section.destroy();
  });

  it('keeps the draft when Escape is pressed on the confirm', async () => {
    const section = createCharacterJournalSection(createFakeService([]));
    await showSection(section);
    openNewSession();
    titleField().value = 'Keep me';
    titleField().dispatchEvent(new Event('input'));
    section.requestHide();

    document.querySelector('.bfa-journal-panel')?.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      key: 'Escape',
    }));

    expect(section.isShown()).toBe(true);
    expect(titleField().value).toBe('Keep me');
    expect(document.querySelector('.bfa-journal-confirm')).toBeNull();
    section.destroy();
  });

  it('closes a clean panel on Escape and returns focus to the row', async () => {
    const section = createCharacterJournalSection(createFakeService([
      note({id: 'door', title: 'Locked door'}),
    ]));
    await showSection(section);
    const row = document.querySelector<HTMLButtonElement>('.bfa-journal-row');
    row?.focus();
    row?.click();

    document.querySelector('.bfa-journal-panel')?.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      key: 'Escape',
    }));

    expect(document.querySelector('.bfa-journal-panel')?.hasAttribute('hidden')).toBe(true);
    expect(document.activeElement).toBe(row);
    expect(section.isShown()).toBe(true);
    section.destroy();
  });

  it('returns to the journal list when Close discards a draft', async () => {
    const section = createCharacterJournalSection(createFakeService([]));
    await showSection(section);
    openNewSession();
    titleField().value = 'Leave this';
    titleField().dispatchEvent(new Event('input'));

    document.querySelector<HTMLButtonElement>('[aria-label="Close"]')?.click();
    expect(document.querySelector('.bfa-journal-confirm')?.textContent)
        .toContain('This note is not saved yet.');
    buttonNamed('Discard')?.click();

    expect(section.isShown()).toBe(true);
    expect(document.querySelector('.bfa-journal-panel')?.hasAttribute('hidden')).toBe(true);
    expect(buttonNamed('Manage Notes')).toBeDefined();
    expect(buttonNamed('File note')).toBeUndefined();
    expect(buttonNamed('New note')).toBeUndefined();
    section.destroy();
  });

  it('keeps the image file input out of the tab order', async () => {
    const section = createCharacterJournalSection(createFakeService([]));
    await showSection(section);
    openNewSession();
    const fileInput = document.querySelector<HTMLInputElement>('.bfa-journal-file-input');
    expect(fileInput?.tabIndex).toBe(-1);
    expect(fileInput?.hidden).toBe(true);
    section.destroy();
  });

  it('does not write a draft onto the character id in the new URL', async () => {
    const savedIds: string[] = [];
    const service = createFakeService([]);
    const save = service.save.bind(service);
    service.save = async (entry, loaded) => {
      savedIds.push(entry.characterId);
      return save(entry, loaded);
    };
    const section = createCharacterJournalSection(service);
    await showSection(section);
    openNewSession();
    titleField().value = 'Belongs to the first sheet';
    titleField().dispatchEvent(new Event('input'));

    section.syncRoute('222');
    await new Promise((resolve) => setTimeout(resolve, 600));

    expect(document.body.textContent).toContain('another character');
    expect(savedIds.every((id) => id === '169418374')).toBe(true);
    section.destroy();
  });

  it('does not paint an in-flight save onto the new character', async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const notes = [note({id: 'door', title: 'Locked door'})];
    const service = createFakeService(notes);
    const save = service.save.bind(service);
    service.save = async (entry, loaded) => {
      await gate;
      return save(entry, loaded);
    };
    const section = createCharacterJournalSection(service);
    await showSection(section);
    document.querySelector<HTMLButtonElement>('.bfa-journal-row')?.click();
    buttonNamed('Edit')?.click();
    titleField().value = 'Changed during navigation';
    titleField().dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 600));
    section.syncRoute('222');
    release();
    await flush();

    expect(notes[0]?.characterId).toBe('169418374');
    expect(notes[0]?.title).toBe('Changed during navigation');
    expect(document.body.textContent).toContain('another character');
    expect(document.querySelector('.bfa-journal-status')?.textContent).not.toBe('Saved');
    section.destroy();
  });

  it('keeps Underdark fields dark when another sheet input is white', async () => {
    const sheet = document.querySelector<HTMLElement>('.ct-character-sheet');
    if (sheet === null) {
      throw new Error('Missing sheet');
    }
    sheet.classList.add('ct-character-sheet--dark-mode');
    sheet.dataset.theme = 'dark';
    sheet.style.backgroundColor = '#1b242b';
    sheet.style.color = '#f2f4f6';
    const decoy = document.createElement('input');
    decoy.style.backgroundColor = 'rgb(255, 255, 255)';
    sheet.prepend(decoy);

    const section = createCharacterJournalSection(createFakeService([]));
    await showSection(section);
    const root = document.querySelector<HTMLElement>('.bfa-character-journal-section');
    const surface = root?.style.getPropertyValue('--bfa-journal-surface').toLowerCase() ?? '';
    expect(
        surface,
        `Underdark field fill ${surface} came from a white input. Matilda's fields stay dark.`,
    ).not.toMatch(/#fff(?:fff)?|rgb\(255,\s*255,\s*255\)/);
    section.destroy();
  });

  it('keeps the Manage Notes label readable against its fill', async () => {
    const sheet = document.querySelector<HTMLElement>('.ct-character-sheet');
    if (sheet === null) {
      throw new Error('Missing sheet');
    }
    sheet.classList.add('ct-character-sheet--dark-mode');
    sheet.dataset.theme = 'dark';
    sheet.style.backgroundColor = '#1b242b';
    sheet.style.color = '#f2f4f6';
    const section = createCharacterJournalSection(createFakeService([]));
    await showSection(section);

    const manage = buttonNamed('Manage Notes');
    const root = document.querySelector<HTMLElement>('.bfa-character-journal-section');
    if (manage === undefined || root === null) {
      throw new Error('Missing Manage Notes');
    }
    const foreground = root.style.getPropertyValue('--bfa-journal-background');
    const background = root.style.getPropertyValue('--bfa-journal-text');
    expect(
        colorsContrast(foreground, background),
        `Manage Notes label ${foreground} on fill ${background} is below 4.5:1.`,
    ).toBe(true);
    expect(document.querySelector('.bfa-journal-chip')).toBeNull();

    sheet.classList.remove('ct-character-sheet--dark-mode');
    sheet.dataset.theme = 'light';
    sheet.style.backgroundColor = '#ffffff';
    sheet.style.color = '#242527';
    sheet.dispatchEvent(new Event('change'));
    document.documentElement.setAttribute('data-theme', 'light');
    await new Promise((resolve) => setTimeout(resolve, 0));
    section.destroy();
  });

  it('loads the new character after Discard and creates the next note there', async () => {
    const saved: string[] = [];
    const notes = [
      note({id: 'gate', title: 'Old Gate'}),
      note({body: 'Still here', id: 'chapel', title: 'Chapel'}),
    ];
    const service = createFakeService(notes);
    const save = service.save.bind(service);
    service.save = async (entry, loaded) => {
      saved.push(entry.characterId);
      return save(entry, loaded);
    };
    const section = createCharacterJournalSection(service);
    await showSection(section);
    document.querySelector<HTMLButtonElement>('.bfa-journal-row')?.click();
    section.syncRoute('222');

    expect(document.body.textContent).toContain('another character');
    expect(titles()).toContain('Old Gate');
    buttonNamed('Manage Notes')?.click();
    await flush();
    expect(saved).toEqual([]);
    expect(document.body.textContent).toContain('Close the open note');

    bannerButton('Discard')?.click();
    await flush();

    expect(document.querySelector('.bfa-journal-panel')?.hasAttribute('hidden')).toBe(true);
    expect(titles()).toEqual([]);
    buttonNamed('Manage Notes')?.click();
    titleField().value = 'Arrived';
    titleField().dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(saved).toEqual(['222']);
    section.destroy();
  });

  it('shows the duplicate picker without leaving the open note', async () => {
    const section = createCharacterJournalSection(createFakeService([
      note({body: 'Ask [[Marcus]]', id: 'errand', title: 'The errand'}),
      note({body: 'First', id: 'marcus-1', title: 'Marcus'}),
      note({
        body: 'Second',
        id: 'marcus-2',
        title: 'Marcus',
        updatedAt: '2026-10-13T00:00:00.000Z',
      }),
    ]));
    await showSection(section);
    rowNamed('The errand')?.click();
    wikiLink('Marcus')?.click();

    expect(document.querySelector('.bfa-journal-picker')).not.toBeNull();
    expect(document.querySelector('.bfa-journal-panel-title')?.textContent).toBe('The errand');
    section.destroy();
  });

  it('leaves an unresolved name unwritten when the link is clicked', async () => {
    let created = 0;
    const notes = [note({body: 'Find [[Ghost]]', id: 'errand', title: 'The errand'})];
    const service = createFakeService(notes);
    const createPlaceholder = service.createPlaceholder.bind(service);
    service.createPlaceholder = async (characterId, title) => {
      created += 1;
      return createPlaceholder(characterId, title);
    };
    const section = createCharacterJournalSection(service);
    await showSection(section);
    rowNamed('The errand')?.click();
    const link = document.querySelector<HTMLButtonElement>('.bfa-journal-wikilink--needs');

    expect(link?.getAttribute('aria-label')).toBe('Ghost, needs details');
    expect(link?.textContent).toBe('Ghost');
    link?.click();
    await flush();
    expect(created).toBe(0);
    expect(notes).toHaveLength(1);
    expect(document.querySelector('.bfa-journal-panel-title')?.textContent).toBe('The errand');
    section.destroy();
  });

  it('inserts starter headings only when the body is still the previous type', async () => {
    const section = createCharacterJournalSection(createFakeService([]));
    await showSection(section);
    openNewSession();
    const select = document.querySelector<HTMLSelectElement>('.bfa-journal-type');
    const editor = document.querySelector<HTMLTextAreaElement>('.bfa-journal-editor');
    if (select === null || editor === null) {
      throw new Error('Missing type control');
    }

    expect(select.value).toBe('session');
    expect(editor.value).toContain('What happened');
    select.value = 'npc';
    select.dispatchEvent(new Event('change'));
    expect(editor.value).toContain('Who they are to me');
    expect(editor.value).not.toContain('What happened');

    editor.value = 'Marcus waved.';
    editor.dispatchEvent(new Event('input'));
    select.value = 'place';
    select.dispatchEvent(new Event('change'));
    expect(editor.value).toBe('Marcus waved.');
    expect(select.value).toBe('place');
    section.destroy();
  });

  it('does not cover the sheet with a scrim', async () => {
    const section = createCharacterJournalSection(createFakeService([
      note({id: 'door', title: 'Locked door'}),
    ]));
    await showSection(section);
    document.querySelector<HTMLButtonElement>('.bfa-journal-row')?.click();
    const panel = document.querySelector<HTMLElement>('.bfa-journal-panel');

    expect(document.querySelector('.bfa-journal-scrim')).toBeNull();
    expect(document.querySelector('[data-bfa-journal-scrim]')).toBeNull();
    expect(panel?.style.getPropertyValue('--bfa-journal-background')).toBe('#fefefe');
    expect(panel?.classList.contains('ct-character-sheet--dark-mode')).toBe(false);
    expect(document.querySelector<HTMLElement>('.bfa-character-journal-section')
        ?.style.getPropertyValue('--bfa-journal-chip')).toBe('#eceeef');
    section.destroy();
  });

  it('keeps close and back in the pane chrome and ignores Unsorted on a typed note', async () => {
    const section = createCharacterJournalSection(createFakeService([
      note({id: 'door', title: 'Locked door', type: 'unset'}),
    ]));
    await showSection(section);
    document.querySelector<HTMLButtonElement>('.bfa-journal-row')?.click();
    const chrome = document.querySelector('.bfa-journal-pane-chrome');
    const sheet = document.querySelector('.bfa-journal-panel-sheet');
    const close = document.querySelector('.bfa-journal-close');
    expect(chrome?.contains(close)).toBe(true);
    expect(sheet?.contains(close)).toBe(false);
    expect(sheet?.querySelector('[aria-label="Back"]')).toBeNull();
    expect(sheet?.querySelector('.bfa-journal-panel-title')).not.toBeNull();
    expect(document.querySelector('.bfa-journal-panel-actions')?.querySelector('.bfa-journal-type'))
        .not.toBeNull();

    const unsetSelect = document.querySelector<HTMLSelectElement>('.bfa-journal-type');
    expect(unsetSelect?.querySelector<HTMLOptionElement>('option[value="unset"]')?.disabled)
        .toBe(false);
    document.querySelector<HTMLButtonElement>('[aria-label="Close"]')?.click();

    openNewSession();
    const select = document.querySelector<HTMLSelectElement>('.bfa-journal-type');
    const unset = select?.querySelector<HTMLOptionElement>('option[value="unset"]');
    if (select === null || unset === null || unset === undefined) {
      throw new Error('Missing type control');
    }
    expect(select.value).toBe('session');
    expect(unset.disabled).toBe(true);
    select.value = 'unset';
    select.dispatchEvent(new Event('change'));
    expect(select.value).toBe('session');
    section.destroy();
  });

  it('clears the previous character list while the new character loads', async () => {
    const notes = [note({body: 'Stays on the first sheet', id: 'gate', title: 'Old Gate'})];
    const savedIds: string[] = [];
    const service = createFakeService(notes);
    const open = service.open.bind(service);
    const save = service.save.bind(service);
    service.save = async (entry, loaded) => {
      savedIds.push(`${entry.characterId}:${entry.id}`);
      return save(entry, loaded);
    };
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const section = createCharacterJournalSection(service);
    await showSection(section);
    service.open = async (characterId) => {
      const result = await open(characterId);
      await gate;
      return result;
    };

    section.syncRoute('222');

    expect(titles()).toEqual([]);
    expect(document.querySelector('.bfa-journal-row')).toBeNull();
    expect(document.querySelector('.bfa-journal-message')?.textContent).toBe('Loading notes');
    document.querySelector<HTMLButtonElement>('.bfa-journal-row')?.click();
    await flush();
    expect(document.querySelector('.bfa-journal-panel')?.hasAttribute('hidden')).toBe(true);
    expect(savedIds).toEqual([]);
    release();
    await flush();
    expect(titles()).toEqual([]);
    expect(notes.map((entry) => entry.characterId)).toEqual(['169418374']);
    section.destroy();
  });

  it('saves a checkbox on the note that changed when a link is followed', async () => {
    const notes = [
      note({
        body: '- [ ] Pack the rope\nSee [[Beta]]',
        id: 'alpha',
        title: 'Alpha',
      }),
      note({body: 'Waiting', id: 'beta', title: 'Beta'}),
    ];
    const saved: string[] = [];
    const service = createFakeService(notes);
    const save = service.save.bind(service);
    service.save = async (entry, loaded) => {
      saved.push(`${entry.id}:${entry.body}`);
      return save(entry, loaded);
    };
    const section = createCharacterJournalSection(service);
    await showSection(section);
    rowNamed('Alpha')?.click();
    document.querySelector<HTMLInputElement>('.bfa-journal-task')?.click();
    wikiLink('Beta')?.click();
    await flush();

    expect(document.querySelector('.bfa-journal-panel-title')?.textContent).toBe('Beta');
    expect(saved.some((entry) => entry.startsWith('alpha:') && entry.includes('[x]'))).toBe(true);
    expect(saved.some((entry) => entry.startsWith('beta:'))).toBe(false);
    expect(notes.find((entry) => entry.id === 'beta')?.body).toBe('Waiting');
    section.destroy();
  });

  it('schedules a save when autocomplete creates a wikilink target', async () => {
    const saved: string[] = [];
    let created = 0;
    const service = createFakeService([]);
    const save = service.save.bind(service);
    service.save = async (entry, loaded) => {
      saved.push(entry.body);
      return save(entry, loaded);
    };
    const createPlaceholder = service.createPlaceholder.bind(service);
    service.createPlaceholder = async (characterId, title) => {
      created += 1;
      return createPlaceholder(characterId, title);
    };
    const section = createCharacterJournalSection(service);
    await showSection(section);
    openNewSession();
    const editor = document.querySelector<HTMLTextAreaElement>('.bfa-journal-editor');
    if (editor === null) {
      throw new Error('Missing editor');
    }
    editor.value = '[[Ghost';
    editor.setSelectionRange(editor.value.length, editor.value.length);
    editor.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 600));
    saved.length = 0;

    document.querySelector<HTMLButtonElement>('.bfa-journal-autocomplete-create')?.click();
    expect(editor.value).toBe('[[Ghost]]');
    expect(created).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(saved.some((body) => body.includes('[[Ghost]]'))).toBe(true);
    section.destroy();
  });

  it('keeps the newer character list when an older reload finishes last', async () => {
    const notes = [note({id: 'gate', title: 'Old Gate'})];
    const service = createFakeService(notes);
    const open = service.open.bind(service);
    const release: Array<() => void> = [];
    const section = createCharacterJournalSection(service);
    await showSection(section);
    service.open = async (characterId) => {
      const result = await open(characterId);
      await new Promise<void>((resolve) => {
        release.push(resolve);
      });
      return result;
    };

    section.syncRoute('222');
    await flush();
    notes.push(note({characterId: '222', id: 'arrived', title: 'Arrived'}));
    section.syncRoute('333');
    await flush();
    section.syncRoute('222');
    await flush();
    expect(release).toHaveLength(3);

    const newest = release[2];
    const older = release[0];
    const middle = release[1];
    if (newest === undefined || older === undefined || middle === undefined) {
      throw new Error('Missing reload gates');
    }
    newest();
    await flush();
    expect(titles()).toEqual(['Arrived']);
    older();
    await flush();
    expect(titles()).toEqual(['Arrived']);
    middle();
    await flush();
    expect(titles()).toEqual(['Arrived']);
    section.destroy();
  });

  it('does not show Extras content inside the journal', async () => {
    const style = document.createElement('style');
    style.textContent = '#native-panel { display: block; }';
    document.head.append(style);
    getNativePanel().textContent = 'Familiar Petal the sprite';
    const section = createCharacterJournalSection(createFakeService([]));
    await showSection(section);

    const native = getNativePanel();
    const journal = document.querySelector('.bfa-character-journal-section');
    expect(native.style.getPropertyPriority('display')).toBe('important');
    expect(native.style.getPropertyValue('display')).toBe('none');
    expect(journal?.contains(native)).toBe(false);
    expect(journal?.textContent).not.toContain('Petal');
    expect(journal?.textContent).not.toContain('Familiar');

    const inserted = document.createElement('div');
    inserted.textContent = 'Reinserted familiar';
    inserted.style.display = 'block';
    getContentHost().append(inserted);
    await flush();
    expect(inserted.style.getPropertyPriority('display')).toBe('important');
    expect(journal?.textContent).not.toContain('Reinserted');

    section.hide();
    expect(native.hidden).toBe(false);
    expect(native.style.getPropertyPriority('display')).toBe('');
    expect(getComputedStyle(native).display).toBe('block');
    style.remove();
    section.destroy();
  });

  it('copies the native section search and filters by more than one type', async () => {
    const shell = document.createElement('div');
    shell.className = 'sheet-search-shell';
    const nativeSearch = document.createElement('input');
    nativeSearch.className = 'sheet-search-input';
    nativeSearch.type = 'search';
    nativeSearch.placeholder = 'Search Names, Types, or Tags';
    shell.append(nativeSearch);
    document.querySelector('.ct-character-sheet')?.append(shell);

    const section = createCharacterJournalSection(createFakeService([
      note({id: 'door', title: 'Locked door', type: 'session'}),
      note({id: 'warden', title: 'Warden', type: 'npc'}),
      note({id: 'chapel', title: 'Chapel', type: 'place'}),
    ]));
    await showSection(section);

    const search = document.querySelector<HTMLInputElement>('.bfa-journal-search');
    expect(search?.classList.contains('sheet-search-input')).toBe(true);
    expect(search?.getAttribute('data-bfa-journal-input-class')).toBe('sheet-search-input');
    expect(search?.parentElement?.classList.contains('sheet-search-shell')).toBe(true);
    expect(document.querySelector('.bfa-journal-quick-note')).toBeNull();

    buttonNamed('Filter')?.click();
    const boxes = document.querySelectorAll<HTMLInputElement>('.bfa-journal-filter input');
    expect(boxes.length).toBe(6);
    const npc = Array.from(boxes).find((box) => box.value === 'npc');
    const place = Array.from(boxes).find((box) => box.value === 'place');
    if (npc === undefined || place === undefined) {
      throw new Error('Missing filter');
    }
    npc.checked = true;
    npc.dispatchEvent(new Event('change'));
    place.checked = true;
    place.dispatchEvent(new Event('change'));
    expect(titles().sort()).toEqual(['Chapel', 'Warden']);
    section.destroy();
  });

  it('renders markdown in the open note and spans the editor across the pane', async () => {
    const section = createCharacterJournalSection(createFakeService([
      note({
        body: [
          '**test** and *soft*',
          '# Hall',
          '- outer\n  - inner',
          'See [site](https://example.com/notes) and [[Voss]].',
        ].join('\n\n'),
        id: 'door',
        title: 'Locked door',
      }),
    ]));
    await showSection(section);
    rowNamed('Locked door')?.click();
    const read = document.querySelector('.bfa-journal-read');
    expect(read?.querySelector('strong')?.textContent).toBe('test');
    expect(read?.querySelector('em')?.textContent).toBe('soft');
    expect(read?.querySelector('h1')?.textContent).toBe('Hall');
    expect(read?.querySelectorAll('ul').length).toBeGreaterThan(1);
    expect(read?.querySelector('a')?.getAttribute('href')).toBe('https://example.com/notes');
    expect(read?.querySelector('.bfa-journal-wikilink')?.textContent).toBe('Voss');
    expect(read?.textContent).not.toContain('**');
    expect(document.querySelector('.bfa-journal-pane-chrome [aria-label="Close"]')).not.toBeNull();
    expect(document.querySelector('.bfa-journal-panel-sheet [aria-label="Close"]')).toBeNull();

    buttonNamed('Edit')?.click();
    const editor = document.querySelector<HTMLTextAreaElement>('.bfa-journal-editor');
    const title = titleField();
    const sheet = document.querySelector('.bfa-journal-panel-sheet');
    expect(editor?.style.width).toBe('100%');
    expect(title.style.width).toBe('100%');
    expect(sheet?.contains(editor)).toBe(true);
    expect(sheet?.contains(document.querySelector('[aria-label="Close"]'))).toBe(false);
    section.destroy();
  });
});

async function showSection(
    section: ReturnType<typeof createCharacterJournalSection>,
): Promise<void> {
  await section.show({
    characterId: '169418374',
    contentHost: getContentHost(),
    tab: getJournalTab(),
  });
}

function createFakeService(notes: JournalNote[]): CharacterJournalService {
  return {
    async attachImage(entry) {
      return entry;
    },
    async countUnreadableEntries() {
      return 0;
    },
    async createPlaceholder(characterId, title) {
      const created = note({characterId, id: `placeholder-${title}`, needsDetails: true, title, type: 'unset'});
      notes.push(created);
      return created;
    },
    async deleteEntry(_characterId, entryId) {
      const index = notes.findIndex((entry) => entry.id === entryId);
      if (index >= 0) {
        notes.splice(index, 1);
      }
    },
    async fileQuickNote(characterId, text) {
      const created = note({body: text, characterId, id: 'quick', title: 'Session'});
      notes.push(created);
      return created;
    },
    async getImage() {
      return null;
    },
    async open(characterId) {
      return {
        migration: 'current',
        notes: notes.filter((entry) => entry.characterId === characterId),
        unreadableCount: 0,
      };
    },
    async removeImage(entry) {
      return entry;
    },
    async save(entry) {
      const saved = {...entry, updatedAt: '2026-10-20T00:00:00.000Z'};
      const index = notes.findIndex((candidate) => candidate.id === entry.id);
      if (index >= 0) {
        notes[index] = saved;
      } else {
        notes.push(saved);
      }
      return {kind: 'saved', note: saved};
    },
  };
}

function note(overrides: Partial<JournalNote> & Pick<JournalNote, 'id' | 'title'>): JournalNote {
  return {
    body: '',
    characterId: '169418374',
    createdAt: '2026-10-12T00:00:00.000Z',
    featuredImageId: null,
    images: [],
    needsDetails: false,
    questStatus: null,
    schemaVersion: 2,
    sessionDate: null,
    type: 'session',
    updatedAt: '2026-10-12T00:00:00.000Z',
    ...overrides,
  };
}

function openNewSession(): void {
  buttonNamed('Manage Notes')?.click();
  const select = document.querySelector<HTMLSelectElement>('.bfa-journal-type');
  if (select === null) {
    throw new Error('Missing type control');
  }
  select.value = 'session';
  select.dispatchEvent(new Event('change'));
}

function titleField(): HTMLInputElement {
  const field = document.querySelector<HTMLInputElement>('.bfa-journal-title-field');
  if (field === null) {
    throw new Error('Missing title field');
  }
  return field;
}

function titles(): string[] {
  return Array.from(
      document.querySelectorAll('.bfa-journal-row-title'),
      (element) => element.textContent ?? '',
  );
}

function buttonNamed(label: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent === label);
}

function bannerButton(label: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('.bfa-journal-banner button'))
      .find((button) => button.textContent === label);
}

function rowNamed(title: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('.bfa-journal-row'))
      .find((button) => button.textContent?.includes(title));
}

function wikiLink(name: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('.bfa-journal-wikilink'))
      .find((button) => button.dataset.bfaWikiName === name);
}

function getJournalTab(): HTMLElement {
  const tab = document.querySelector<HTMLElement>('#journal-tab');
  if (tab === null) {
    throw new Error('Missing journal tab');
  }
  return tab;
}

function getContentHost(): HTMLElement {
  const host = document.querySelector<HTMLElement>('#content-host');
  if (host === null) {
    throw new Error('Missing content host');
  }
  return host;
}

function getNativePanel(): HTMLElement {
  const panel = document.querySelector<HTMLElement>('#native-panel');
  if (panel === null) {
    throw new Error('Missing native panel');
  }
  return panel;
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}
