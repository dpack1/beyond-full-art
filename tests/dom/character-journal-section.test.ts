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
    expect(document.querySelector('.ct-sidebar[data-bfa-journal-panel]')).not.toBeNull();

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

  it('uses a pressed chip whose label contrasts with the pill', async () => {
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

    const chip = document.querySelector<HTMLElement>('.bfa-journal-chip[aria-checked="true"]');
    const root = document.querySelector<HTMLElement>('.bfa-character-journal-section');
    if (chip === null || root === null) {
      throw new Error('Missing pressed chip');
    }
    const foreground = root.style.getPropertyValue('--bfa-journal-background');
    const background = root.style.getPropertyValue('--bfa-journal-text');
    expect(
        colorsContrast(foreground, background),
        `Pressed All chip label ${foreground} on fill ${background} is below 4.5:1. The Notes-tab pill is unreadable.`,
    ).toBe(true);
    expect(chip.textContent ?? '').toMatch(/All/);

    sheet.classList.remove('ct-character-sheet--dark-mode');
    sheet.dataset.theme = 'light';
    sheet.style.backgroundColor = '#ffffff';
    sheet.style.color = '#242527';
    sheet.dispatchEvent(new Event('change'));
    document.documentElement.setAttribute('data-theme', 'light');
    await new Promise((resolve) => setTimeout(resolve, 0));
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
  buttonNamed('New note')?.click();
  buttonNamed('Session')?.click();
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
