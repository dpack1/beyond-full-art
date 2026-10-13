import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {createCharacterJournalSection} from '../../src/features/character-journal/character-journal-section';
import type {CharacterJournalService} from '../../src/features/character-journal/character-journal-service';
import type {CharacterJournalEntry} from '../../src/features/character-journal/character-journal-types';

describe('character journal section', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="journal-tab" type="button">Journal</button>
      <section id="content-host">
        <div id="native-panel">Native sheet panel</div>
      </section>
    `;
    document.head.querySelector('[data-bfa-character-journal-styles]')?.remove();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.head.querySelector('[data-bfa-character-journal-styles]')?.remove();
    vi.restoreAllMocks();
  });

  it('shows inline in the content host and preserves native content for restore', async () => {
    const section = createCharacterJournalSection(createFakeService([]));
    const host = getContentHost();
    const nativePanel = getNativePanel();

    await section.show({
      characterId: '169418374',
      contentHost: host,
      tab: getJournalTab(),
    });

    expect(host.querySelector('.bfa-character-journal-section')).not.toBeNull();
    expect(nativePanel.hidden).toBe(true);
    expect(document.querySelector('.bfa-character-journal-images')).not.toBeNull();
    expect(document.querySelector('.bfa-character-journal-list')?.textContent)
        .toContain('No entries yet.');

    section.hide();

    expect(nativePanel.hidden).toBe(false);
    expect(section.isShown()).toBe(false);

    section.destroy();
  });

  it('saves a new note entry inside the section', async () => {
    const entries: CharacterJournalEntry[] = [];
    const section = createCharacterJournalSection(createFakeService(entries));

    await showSection(section);
    getTitleInput().value = 'First session';
    getBodyInput().value = 'Matilda found the locked door.';
    getSaveButton().click();
    await flushPromises();

    expect(entries).toHaveLength(1);
    expect(entries[0]?.title).toBe('First session');
    expect(entries[0]?.blocks[0]?.text).toBe('Matilda found the locked door.');
    expect(getEditorStatus().textContent).toBe('Saved.');

    section.destroy();
  });

  it('loads, edits, and deletes an existing note entry', async () => {
    const entries = [
      createEntry({
        id: 'entry-1',
        text: 'Old text.',
        title: 'Old title',
      }),
    ];
    const section = createCharacterJournalSection(createFakeService(entries));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await showSection(section);

    expect(getTitleInput().value).toBe('Old title');
    expect(getBodyInput().value).toBe('Old text.');

    getTitleInput().value = 'Updated title';
    getBodyInput().value = 'Updated text.';
    getSaveButton().click();
    await flushPromises();

    expect(entries[0]?.title).toBe('Updated title');
    expect(entries[0]?.blocks[0]?.text).toBe('Updated text.');

    getDeleteButton().click();
    await flushPromises();

    expect(entries).toEqual([]);
    expect(getEditorStatus().textContent).toBe('Deleted.');

    section.destroy();
  });

  it('preserves editor text after a failed save', async () => {
    const section = createCharacterJournalSection(createFakeService([], {
      saveError: new Error('No storage today'),
    }));

    await showSection(section);
    getTitleInput().value = 'Unsaved title';
    getBodyInput().value = 'Unsaved body';
    getSaveButton().click();
    await flushPromises();

    expect(getTitleInput().value).toBe('Unsaved title');
    expect(getBodyInput().value).toBe('Unsaved body');
    expect(getEditorStatus().textContent)
        .toBe('Entry could not be saved. Your text is still here.');

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

function createFakeService(
    entries: CharacterJournalEntry[],
    options: {saveError?: Error} = {},
): CharacterJournalService {
  return {
    async deleteEntry(_characterId, entryId) {
      const entryIndex = entries.findIndex((entry) => entry.id === entryId);
      if (entryIndex >= 0) {
        entries.splice(entryIndex, 1);
      }
    },
    async listEntries(characterId) {
      return entries.filter((entry) => entry.characterId === characterId);
    },
    async saveTextEntry(draft) {
      if (options.saveError !== undefined) {
        throw options.saveError;
      }

      const existingEntry = draft.entryId === undefined
        ? undefined
        : entries.find((entry) => entry.id === draft.entryId);
      const entry = createEntry({
        id: existingEntry?.id ?? 'entry-1',
        text: draft.text,
        title: draft.title.trim() === '' ? 'Untitled entry' : draft.title.trim(),
      });
      const existingIndex = entries.findIndex((candidate) => candidate.id === entry.id);
      if (existingIndex >= 0) {
        entries[existingIndex] = entry;
      } else {
        entries.unshift(entry);
      }

      return entry;
    },
  };
}

function createEntry(overrides: {
  id: string;
  text: string;
  title: string;
}): CharacterJournalEntry {
  return {
    blocks: [
      {
        id: `${overrides.id}-block`,
        text: overrides.text,
        type: 'text',
      },
    ],
    characterId: '169418374',
    createdAt: '2026-10-12T00:00:00.000Z',
    id: overrides.id,
    schemaVersion: 1,
    title: overrides.title,
    updatedAt: '2026-10-12T00:00:00.000Z',
  };
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

function getTitleInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(
      '.bfa-character-journal-title-input',
  );
  if (input === null) {
    throw new Error('Missing title input');
  }

  return input;
}

function getBodyInput(): HTMLTextAreaElement {
  const input = document.querySelector<HTMLTextAreaElement>(
      '.bfa-character-journal-body-input',
  );
  if (input === null) {
    throw new Error('Missing body input');
  }

  return input;
}

function getSaveButton(): HTMLButtonElement {
  const button = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
          '.bfa-character-journal-button',
      ),
  ).find((candidate) => candidate.textContent === 'Save');
  if (button === undefined) {
    throw new Error('Missing save button');
  }

  return button;
}

function getDeleteButton(): HTMLButtonElement {
  const button = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
          '.bfa-character-journal-button',
      ),
  ).find((candidate) => candidate.textContent === 'Delete');
  if (button === undefined) {
    throw new Error('Missing delete button');
  }

  return button;
}

function getEditorStatus(): HTMLParagraphElement {
  const status = document.querySelector<HTMLParagraphElement>(
      '.bfa-character-journal-editor > .bfa-character-journal-status',
  );
  if (status === null) {
    throw new Error('Missing editor status');
  }

  return status;
}

async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
