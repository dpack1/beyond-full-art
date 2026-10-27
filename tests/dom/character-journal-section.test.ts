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
    vi.unstubAllGlobals();
  });

  it('shows the list in the content host and says there are no notes', async () => {
    const section = createCharacterJournalSection(createFakeService([]));
    await showSection(section);

    expect(getContentHost().querySelector('.bfa-character-journal-section')).not.toBeNull();
    expect(getComputedStyle(
        getContentHost().querySelector<HTMLElement>('.bfa-character-journal-section')!,
    ).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(getNativePanel().hidden).toBe(true);
    expect(document.querySelector('.bfa-journal-message')?.textContent).toBe('No notes');
    expect(document.querySelector('[data-bfa-journal-panel]')?.hasAttribute('hidden')).toBe(true);
    expect(getContentHost().querySelector('.ct-sidebar')).toBeNull();
    const row = document.querySelector('[data-bfa-journal-native-chrome]');
    expect(row?.querySelector('.ct-extras-filter__icon')).not.toBeNull();
    expect(row?.querySelector('.ct-extras-filter__input')).not.toBeNull();
    expect(row?.querySelector('.ddbc-filter-svg')).not.toBeNull();
    expect(row?.querySelector('[aria-label="Filter"]')?.textContent?.trim()).toBe('');
    expect(row?.querySelector('.bfa-journal-manage')?.textContent).toBe('New Note');
    const sync = buttonNamed('Sync folder');
    expect(sync?.textContent).toBe('');
    expect(sync?.parentElement).toBe(row?.querySelector('.bfa-journal-manage')?.parentElement);
    expect(row?.contains(document.querySelector('.bfa-journal-filter'))).toBe(false);

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
    expect(document.querySelector('.bfa-journal-row-preview')).toBeNull();
    search.value = 'nope';
    search.dispatchEvent(new Event('input'));
    expect(document.querySelector('.bfa-journal-message')?.textContent).toBe('No matches');
    section.destroy();
  });

  it('shows a quiet created date and keeps optional summary details hidden', async () => {
    const section = createCharacterJournalSection(createFakeService([
      note({
        body: 'A locked door under the chapel.',
        id: 'door',
        title: 'Locked door',
        updatedAt: '2026-10-27T00:00:00.000Z',
      }),
    ]));
    await showSection(section);

    const created = document.querySelector<HTMLTimeElement>('.bfa-journal-row-created');
    expect(created?.dateTime).toBe('2026-10-12T00:00:00.000Z');
    expect(created?.textContent).not.toMatch(/created/i);
    expect(document.querySelector('.bfa-journal-row-preview')).toBeNull();
    expect(document.querySelector('.bfa-journal-row-updated')).toBeNull();
    expect(document.querySelector('.bfa-journal-thumb')).toBeNull();

    section.destroy();
  });

  it('keeps note rows out of native button styling after a sheet repaint', async () => {
    const nativeButton = document.querySelector<HTMLButtonElement>('#journal-tab');
    nativeButton?.classList.add('ddbc-button');
    const section = createCharacterJournalSection(createFakeService([
      note({id: 'door', title: 'Locked door'}),
    ]));
    await showSection(section);

    const row = document.querySelector<HTMLButtonElement>('.bfa-journal-row');
    expect(row?.classList.contains('ddbc-button')).toBe(false);

    const sheet = document.querySelector<HTMLElement>('.ct-character-sheet');
    sheet?.style.setProperty('--sheet-scroll-state', 'scrolled');
    await flush();

    expect(row?.classList.contains('ddbc-button')).toBe(false);
    expect(row?.hasAttribute('data-bfa-journal-button-class')).toBe(false);
    section.destroy();
  });

  it('renders optional list details when their preferences are enabled', async () => {
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:journal-thumb');
    URL.revokeObjectURL = vi.fn();
    const service = createFakeService([
      note({
        body: 'A locked door under the chapel.',
        featuredImageId: 'door-photo',
        id: 'door',
        images: [{
          altText: 'door.png',
          blobKey: 'bfa.journal.image.door-photo',
          byteSize: 1,
          fileName: 'door.png',
          height: 1,
          id: 'door-photo',
          mimeType: 'image/png',
          width: 1,
        }],
        title: 'Locked door',
        updatedAt: '2026-10-27T00:00:00.000Z',
      }),
    ]);
    service.getImage = async () => ({
      byteBuffer: new Uint8Array([1]).buffer,
      mimeType: 'image/png',
    });
    const section = createCharacterJournalSection(service);
    await showSection(section);

    section.setListPreferences({
      showPreview: true,
      showThumbnail: true,
      showUpdatedDate: true,
    });

    expect(document.querySelector('.bfa-journal-row-preview')?.textContent)
        .toContain('locked door under the chapel');
    expect(document.querySelector('.bfa-journal-row-updated')?.textContent)
        .toMatch(/^Updated /);
    expect(document.querySelector<HTMLImageElement>('.bfa-journal-thumb img')?.src)
        .toBe('blob:journal-thumb');

    section.destroy();
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
  });

  it('checks the folder without replacing a dirty draft', async () => {
    vi.stubGlobal('chrome', {
      runtime: {lastError: undefined},
      storage: {
        local: {
          get(_key: string, callback: (value: Record<string, unknown>) => void) {
            callback({'bfa.library.mode': 'folder'});
          },
          set(_values: Record<string, unknown>, callback: () => void) {
            callback();
          },
        },
      },
    });
    const stored = [note({body: 'Folder version one', id: 'camp', title: 'Camp'})];
    const section = createCharacterJournalSection(createFakeService(stored));
    await showSection(section);
    await flush();
    document.querySelector<HTMLButtonElement>('.bfa-journal-row')?.click();
    buttonNamed('Edit')?.click();
    titleField().value = 'My unsaved draft';
    titleField().dispatchEvent(new Event('input'));
    stored[0] = {
      ...stored[0] as JournalNote,
      body: 'Newer folder text',
      updatedAt: '2026-10-27T00:00:00.000Z',
    };

    buttonNamed('Sync folder')?.click();
    await flush();

    expect(titleField().value).toBe('My unsaved draft');
    expect(document.querySelector('.bfa-journal-banner')?.textContent)
        .toContain('The folder has a newer copy. Your draft is still here.');
    expect(buttonNamed('Save')).not.toBeNull();
    expect(buttonNamed('Discard draft')).not.toBeNull();
    buttonNamed('Keep both')?.click();
    await flush();

    expect(stored).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'camp-copy',
        title: 'My unsaved draft (other computer)',
      }),
    ]));
    expect(titleField().value).toBe('Camp');
    section.destroy();
  });

  it('replaces a clean open editor when Sync folder finds a newer note', async () => {
    vi.stubGlobal('chrome', {
      runtime: {lastError: undefined},
      storage: {
        local: {
          get(_key: string, callback: (value: Record<string, unknown>) => void) {
            callback({'bfa.library.mode': 'folder'});
          },
          set(_values: Record<string, unknown>, callback: () => void) {
            callback();
          },
        },
      },
    });
    const stored = [note({body: 'Folder version one', id: 'camp', title: 'Camp'})];
    const section = createCharacterJournalSection(createFakeService(stored));
    await showSection(section);
    await flush();
    document.querySelector<HTMLButtonElement>('.bfa-journal-row')?.click();
    buttonNamed('Edit')?.click();
    stored[0] = {
      ...stored[0] as JournalNote,
      body: 'Newer folder text',
      title: 'Newer camp',
      updatedAt: '2026-10-27T00:00:00.000Z',
    };

    buttonNamed('Sync folder')?.click();
    await flush();

    expect(titleField().value).toBe('Newer camp');
    expect(document.querySelector<HTMLTextAreaElement>('.bfa-journal-editor')?.value)
        .toBe('Newer folder text');
    expect(document.querySelector('.bfa-journal-banner')).toBeNull();
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

  it('replaces the footer delete button with right-aligned confirmation actions', async () => {
    const section = createCharacterJournalSection(createFakeService([
      note({id: 'door', title: 'Locked door'}),
    ]));
    await showSection(section);
    document.querySelector<HTMLButtonElement>('.bfa-journal-row')?.click();

    buttonNamed('Delete note')?.click();

    const footer = document.querySelector('.bfa-journal-panel-footer');
    const confirm = footer?.querySelector<HTMLElement>('.bfa-journal-confirm');
    const actions = confirm?.querySelector<HTMLElement>('.bfa-journal-confirm-actions');
    expect(confirm?.getAttribute('role')).toBe('alertdialog');
    expect(confirm?.textContent).toContain('Delete this note?');
    expect(Array.from(actions?.querySelectorAll('button') ?? [], (button) => button.textContent))
        .toEqual(['Keep note', 'Delete note']);
    expect(actions?.className).toBe('bfa-journal-confirm-actions');
    expect(footer?.querySelectorAll('button')).toHaveLength(2);
    expect(document.activeElement).toBe(buttonNamed('Keep note'));

    buttonNamed('Keep note')?.click();
    expect(footer?.querySelector('.bfa-journal-confirm')).toBeNull();
    expect(footer?.querySelector('button')?.textContent).toBe('Delete note');
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

  it('closes a clean note when clicking outside without stealing focus', async () => {
    const section = createCharacterJournalSection(createFakeService([
      note({id: 'door', title: 'Locked door'}),
    ]));
    await showSection(section);
    rowNamed('Locked door')?.click();
    const outside = document.createElement('button');
    outside.textContent = 'Outside action';
    document.body.append(outside);
    outside.focus();

    outside.click();

    expect(document.querySelector('.bfa-journal-panel')?.hasAttribute('hidden')).toBe(true);
    expect(document.activeElement).toBe(outside);
    section.destroy();
  });

  it('does not treat the click that opens a note as an outside click', async () => {
    const section = createCharacterJournalSection(createFakeService([
      note({id: 'door', title: 'Locked door'}),
    ]));
    await showSection(section);

    rowNamed('Locked door')?.click();

    expect(document.querySelector('.bfa-journal-panel')?.hasAttribute('hidden')).toBe(false);
    expect(document.querySelector('.bfa-journal-panel-title')?.textContent).toBe('Locked door');
    section.destroy();
  });

  it('keeps the sidebar open when an inside button rerenders its clicked icon', async () => {
    const section = createCharacterJournalSection(createFakeService([
      note({id: 'door', title: 'Locked door'}),
    ]));
    await showSection(section);
    rowNamed('Locked door')?.click();
    const editIcon = buttonNamed('Edit')?.querySelector('svg');

    editIcon?.dispatchEvent(new MouseEvent('click', {bubbles: true, composed: true}));

    expect(document.querySelector('.bfa-journal-panel')?.hasAttribute('hidden')).toBe(false);
    expect(document.querySelector('.bfa-journal-editor')).not.toBeNull();
    section.destroy();
  });

  it('preserves reading progress when switching to the editor', async () => {
    const section = createCharacterJournalSection(createFakeService([
      note({body: 'A long backstory.\n\n'.repeat(80), id: 'story', title: 'My Beginning'}),
    ]));
    await showSection(section);
    rowNamed('My Beginning')?.click();
    const scroller = document.querySelector<HTMLElement>('[data-scrollable-container="true"]');
    if (scroller === null) {
      throw new Error('Missing sidebar scroller');
    }
    Object.defineProperty(scroller, 'scrollHeight', {configurable: true, value: 1000});
    Object.defineProperty(scroller, 'clientHeight', {configurable: true, value: 200});
    scroller.scrollTop = 400;

    buttonNamed('Edit')?.click();
    const editor = document.querySelector<HTMLTextAreaElement>('.bfa-journal-editor');
    if (editor === null) {
      throw new Error('Missing editor');
    }
    Object.defineProperty(editor, 'scrollHeight', {configurable: true, value: 1200});
    Object.defineProperty(editor, 'clientHeight', {configurable: true, value: 200});
    await flush();

    expect(editor.scrollTop).toBe(500);
    section.destroy();
  });

  it('asks before discarding a dirty note clicked away from the sidebar', async () => {
    const section = createCharacterJournalSection(createFakeService([]));
    await showSection(section);
    openNewSession();
    titleField().value = 'Keep this draft';
    titleField().dispatchEvent(new Event('input'));
    const outside = document.createElement('button');
    outside.textContent = 'Outside action';
    document.body.append(outside);

    outside.click();

    expect(document.querySelector('.bfa-journal-confirm')?.textContent)
        .toContain('This note is not saved yet.');
    expect(titleField().value).toBe('Keep this draft');
    buttonNamed('Keep editing')?.click();
    expect(document.querySelector('.bfa-journal-panel')?.hasAttribute('hidden')).toBe(false);

    outside.click();
    buttonNamed('Discard')?.click();
    expect(document.querySelector('.bfa-journal-panel')?.hasAttribute('hidden')).toBe(true);
    section.destroy();
  });

  it('discards an empty new note when clicking away without saving it', async () => {
    let saves = 0;
    const service = createFakeService([]);
    const save = service.save.bind(service);
    service.save = async (entry, loadedUpdatedAt) => {
      saves += 1;
      return save(entry, loadedUpdatedAt);
    };
    const section = createCharacterJournalSection(service);
    await showSection(section);
    buttonNamed('New Note')?.click();

    const type = document.querySelector<HTMLSelectElement>('.bfa-journal-type');
    if (type === null) {
      throw new Error('Missing type control');
    }
    type.value = 'session';
    type.dispatchEvent(new Event('change'));
    await new Promise((resolve) => setTimeout(resolve, 600));

    const outside = document.createElement('button');
    outside.textContent = 'Outside action';
    document.body.append(outside);
    outside.click();

    expect(saves).toBe(0);
    expect(document.querySelector('.bfa-journal-panel')?.hasAttribute('hidden')).toBe(true);
    expect(document.querySelector('.bfa-journal-row')).toBeNull();
    section.destroy();
  });

  it('does not dismiss the note for clicks in the photo viewer', async () => {
    const section = createCharacterJournalSection(createFakeService([
      note({id: 'door', title: 'Locked door'}),
    ]));
    await showSection(section);
    rowNamed('Locked door')?.click();
    const viewer = document.querySelector<HTMLElement>('.bfa-journal-photo-viewer');
    viewer?.dispatchEvent(new MouseEvent('click', {bubbles: true}));

    expect(document.querySelector('.bfa-journal-panel')?.hasAttribute('hidden')).toBe(false);
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
    expect(buttonNamed('New Note')).toBeDefined();
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

  it('keeps the New Note label readable against its fill', async () => {
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

    const manage = buttonNamed('New Note');
    const root = document.querySelector<HTMLElement>('.bfa-character-journal-section');
    if (manage === undefined || root === null) {
      throw new Error('Missing New Note');
    }
    const foreground = root.style.getPropertyValue('--bfa-journal-background');
    const background = root.style.getPropertyValue('--bfa-journal-text');
    expect(
        colorsContrast(foreground, background),
        `New Note label ${foreground} on fill ${background} is below 4.5:1.`,
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
    buttonNamed('New Note')?.click();
    await flush();
    expect(saved).toEqual([]);
    expect(document.body.textContent).toContain('Close the open note');

    bannerButton('Discard')?.click();
    await flush();

    expect(document.querySelector('.bfa-journal-panel')?.hasAttribute('hidden')).toBe(true);
    expect(titles()).toEqual([]);
    buttonNamed('New Note')?.click();
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

  it('changes the note type without replacing the note body', async () => {
    const section = createCharacterJournalSection(createFakeService([]));
    await showSection(section);
    buttonNamed('New Note')?.click();
    const select = document.querySelector<HTMLSelectElement>('.bfa-journal-type');
    const editor = document.querySelector<HTMLTextAreaElement>('.bfa-journal-editor');
    if (select === null || editor === null) {
      throw new Error('Missing type control');
    }

    expect(select.value).toBe('unset');
    expect(editor.value).toBe('');
    editor.value = 'Marcus waved.';
    editor.dispatchEvent(new Event('input'));
    select.value = 'npc';
    select.dispatchEvent(new Event('change'));
    expect(editor.value).toBe('Marcus waved.');
    expect(select.value).toBe('npc');
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
    const notePane = document.querySelector('.ct-note-manage-pane');
    const close = document.querySelector('.bfa-journal-close');
    expect(document.querySelector('.bfa-journal-panel [data-bfa-journal-native-chrome]')?.contains(close)).toBe(true);
    expect(notePane?.contains(close)).toBe(false);
    expect(notePane?.querySelector('[aria-label="Prev"]')).toBeNull();
    expect(notePane?.querySelector('.bfa-journal-panel-title')).not.toBeNull();
    expect(document.querySelector('.bfa-journal-sticky-tools')?.querySelector('.bfa-journal-type'))
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

  it('uses the extras search row and filters by more than one type', async () => {
    const decoy = document.createElement('input');
    decoy.className = 'site-header-search';
    decoy.type = 'search';
    decoy.placeholder = 'Search D&D Beyond';
    document.body.prepend(decoy);

    const live = document.createElement('div');
    live.className = 'ct-extras-filter__interactions';
    live.innerHTML = `
      <div class="ct-extras-filter__box live-search-box">
        <div class="ct-extras-filter__primary">
          <div class="ct-extras-filter__primary-group ct-extras-filter__primary-group--first">
            <div class="ct-extras-filter__icon"></div>
          </div>
          <div class="ct-extras-filter__field">
            <input class="ct-extras-filter__input live-search-input" type="search" placeholder="Search Names, Types, or Tags">
          </div>
        </div>
      </div>
      <div class="ct-extras-filter__advanced"><svg class="ddbc-filter-svg" viewBox="0 0 29 31"></svg></div>
    `;
    document.querySelector('.ct-character-sheet')?.append(live);

    const section = createCharacterJournalSection(createFakeService([
      note({id: 'door', title: 'Locked door', type: 'session'}),
      note({id: 'warden', title: 'Warden', type: 'npc'}),
      note({id: 'chapel', title: 'Chapel', type: 'place'}),
    ]));
    await showSection(section);

    const row = document.querySelector('[data-bfa-journal-native-chrome]');
    const search = row?.querySelector<HTMLInputElement>('.bfa-journal-search');
    expect(search?.classList.contains('live-search-input')).toBe(true);
    expect(search?.classList.contains('site-header-search')).toBe(false);
    expect(row?.querySelector('.ct-extras-filter__icon')).not.toBeNull();
    expect(row?.querySelector('.live-search-box')).not.toBeNull();
    expect(row?.querySelector('svg')).not.toBeNull();
    expect(row?.querySelector('.bfa-journal-manage')?.textContent).toBe('New Note');
    expect(row?.contains(document.querySelector('.bfa-journal-filter'))).toBe(false);
    expect(document.querySelector('.bfa-journal-quick-note')).toBeNull();
    expect(live.querySelector('button')?.textContent ?? '').not.toBe('New Note');

    document.querySelector<HTMLElement>('[aria-label="Filter"]')?.click();
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
          '- [ ] packed',
          'See [site](https://example.com/notes) and [[Voss]].',
        ].join('\n\n'),
        id: 'door',
        title: 'Locked door',
      }),
    ]));
    await showSection(section);
    rowNamed('Locked door')?.click();
    const read = document.querySelector('.bfa-journal-read');
    const strong = read?.querySelector('strong');
    const em = read?.querySelector('em');
    expect(strong?.textContent).toBe('test');
    expect(em?.textContent).toBe('soft');
    expect(read?.querySelector('h1')?.textContent).toBe('Hall');
    expect(read?.querySelector('ul ul')).not.toBeNull();
    expect(read?.querySelector('input[type="checkbox"]')).not.toBeNull();
    expect(read?.querySelector('a')?.getAttribute('href')).toBe('https://example.com/notes');
    expect(read?.querySelector('.bfa-journal-wikilink')?.textContent).toBe('Voss');
    expect(read?.textContent).not.toContain('**');
    expect(read?.textContent).not.toContain('*soft*');
    if (strong instanceof HTMLElement && em instanceof HTMLElement && read instanceof HTMLElement) {
      expect(['700', 'bold']).toContain(getComputedStyle(strong).fontWeight);
      expect(getComputedStyle(em).fontStyle).toBe('italic');
      const heading = read.querySelector('h1');
      expect(heading instanceof HTMLElement && ['700', 'bold'].includes(getComputedStyle(heading).fontWeight)).toBe(true);
      expect(getComputedStyle(read).whiteSpace).not.toBe('pre-wrap');
      const list = read.querySelector('ul');
      const listType = list instanceof HTMLElement ? getComputedStyle(list).listStyleType : '';
      expect(['disc', '']).toContain(listType);
    }
    expect(document.querySelector('[data-bfa-journal-native-chrome] [aria-label="Close"]')).not.toBeNull();
    expect(document.querySelector('.ct-note-manage-pane [aria-label="Close"]')).toBeNull();

    const header = document.querySelector('.bfa-journal-header-primary');
    const direction = header instanceof HTMLElement ? getComputedStyle(header).flexDirection : '';
    expect(['column', '']).toContain(direction);
    buttonNamed('Edit')?.click();
    const editor = document.querySelector<HTMLTextAreaElement>('.bfa-journal-editor');
    const title = titleField();
    const notePane = document.querySelector('.ct-note-manage-pane');
    const done = buttonNamed('Done editing');
    expect(done?.getAttribute('aria-pressed')).toBe('true');
    expect(done?.querySelector('svg')).not.toBeNull();
    expect(done?.textContent).toBe('');
    expect(document.querySelectorAll('.bfa-journal-format-bar .bfa-journal-icon-button')).toHaveLength(7);
    expect(editor?.style.width).toBe('100%');
    expect(title.style.width).toBe('100%');
    expect(header?.contains(title)).toBe(true);
    expect(document.querySelector('.bfa-journal-sticky-tools')?.contains(done ?? null)).toBe(true);
    expect(notePane?.contains(editor)).toBe(true);
    expect(notePane?.contains(document.querySelector('[aria-label="Close"]'))).toBe(false);
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
    async keepBoth(entry) {
      const copy = {...entry, id: `${entry.id}-copy`, title: `${entry.title} (other computer)`};
      notes.push(copy);
      return copy;
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
  buttonNamed('New Note')?.click();
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
      .find((button) =>
        button.textContent === label
        || button.getAttribute('aria-label') === label
        || button.title === label);
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
