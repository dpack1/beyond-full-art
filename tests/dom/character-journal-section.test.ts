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
        .toContain('No notes yet.');

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
    expect(entries[0]?.blocks[0]?.type === 'text'
      ? entries[0].blocks[0].text
      : '').toBe('Matilda found the locked door.');
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

    await showSection(section);

    expect(getTitleInput().value).toBe('Old title');
    expect(getBodyInput().value).toBe('Old text.');

    getTitleInput().value = 'Updated title';
    getBodyInput().value = 'Updated text.';
    getSaveButton().click();
    await flushPromises();

    expect(entries[0]?.title).toBe('Updated title');
    expect(entries[0]?.blocks[0]?.type === 'text'
      ? entries[0].blocks[0].text
      : '').toBe('Updated text.');

    getDeleteButton().click();
    getButton('Delete note').click();
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

  it('filters notes by the search query', async () => {
    const entries = [
      createEntry({
        id: 'entry-door',
        text: 'A locked door under the chapel.',
        title: 'Locked door',
        updatedAt: '2026-10-13T00:00:00.000Z',
      }),
      createEntry({
        id: 'entry-market',
        text: 'Bought rope and rations.',
        title: 'Market day',
        updatedAt: '2026-10-12T00:00:00.000Z',
      }),
    ];
    const section = createCharacterJournalSection(createFakeService(entries));

    await showSection(section);
    const search = document.querySelector<HTMLInputElement>(
        '.bfa-character-journal-search',
    );
    if (search === null) {
      throw new Error('Missing search input');
    }

    search.value = 'chapel';
    search.dispatchEvent(new Event('input'));

    const titles = Array.from(
        document.querySelectorAll('.bfa-character-journal-entry-title'),
        (element) => element.textContent,
    );
    expect(titles).toEqual(['Locked door']);

    search.value = 'nope';
    search.dispatchEvent(new Event('input'));
    expect(document.querySelector('.bfa-character-journal-list')?.textContent)
        .toContain('The open note is hidden by this search.');

    section.destroy();
  });

  it('adds a photo to the open note', async () => {
    const entries: CharacterJournalEntry[] = [];
    const section = createCharacterJournalSection(createFakeService(entries));

    await showSection(section);
    getTitleInput().value = 'Camp';
    getBodyInput().value = 'Rain on the tent.';
    const input = document.querySelector<HTMLInputElement>(
        '.bfa-character-journal-photo-input',
    );
    if (input === null) {
      throw new Error('Missing photo input');
    }

    const file = new File(['photo'], 'camp.png', {type: 'image/png'});
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: {0: file, length: 1},
    });
    input.dispatchEvent(new Event('change'));
    await flushPromises();

    expect(document.querySelector('[aria-label="View photo camp.png"]'))
        .not.toBeNull();
    expect(entries[0]?.blocks.some((block) => block.type === 'image')).toBe(true);

    section.destroy();
  });

  it('deletes the note the confirmation was opened for', async () => {
    const entries = [
      createEntry({
        id: 'entry-door',
        text: 'A locked door under the chapel.',
        title: 'Locked door',
        updatedAt: '2026-10-13T00:00:00.000Z',
      }),
      createEntry({
        id: 'entry-market',
        text: 'Bought rope and rations.',
        title: 'Market day',
        updatedAt: '2026-10-12T00:00:00.000Z',
      }),
    ];
    const deletedIds: string[] = [];
    const service = createFakeService(entries);
    const deleteEntry = service.deleteEntry.bind(service);
    service.deleteEntry = async (characterId, entryId) => {
      deletedIds.push(entryId);
      await deleteEntry(characterId, entryId);
    };
    const section = createCharacterJournalSection(service);

    await showSection(section);
    expect(getTitleInput().value).toBe('Locked door');

    getDeleteButton().click();
    expect(getConfirmText()).toContain('Locked door');

    getEntryButton('Market day').click();
    expect(getTitleInput().value).toBe('Market day');
    expect(getConfirmText()).toContain('Locked door');

    getConfirmButton('Delete note').click();
    await flushPromises();

    expect(deletedIds).toEqual(['entry-door']);
    expect(entries.map((entry) => entry.id)).toEqual(['entry-market']);
    expect(getTitleInput().value).toBe('Market day');

    section.destroy();
  });

  it('releases a photo object URL when that photo is removed', async () => {
    const objectUrls = installObjectUrlStub();
    const entries = [createPhotoEntry()];
    const section = createCharacterJournalSection(createFakeService(entries));

    try {
      await showSection(section);
      await flushPromises();

      getButton('Remove').click();
      getConfirmButton('Remove photo').click();
      await flushPromises();

      expect(objectUrls.revoked).toEqual(['blob:journal-photo-1']);
      expect(document.querySelector('[aria-label="View photo camp.png"]'))
          .toBeNull();
    } finally {
      section.destroy();
      expect(objectUrls.revoked).toEqual(['blob:journal-photo-1']);
      objectUrls.restore();
    }
  });

  it('releases photo object URLs when the note that owns them is deleted', async () => {
    const objectUrls = installObjectUrlStub();
    const entries = [createPhotoEntry()];
    const section = createCharacterJournalSection(createFakeService(entries));

    try {
      await showSection(section);
      await flushPromises();

      getDeleteButton().click();
      getConfirmButton('Delete note').click();
      await flushPromises();

      expect(entries).toEqual([]);
      expect(objectUrls.revoked).toEqual(['blob:journal-photo-1']);
    } finally {
      section.destroy();
      objectUrls.restore();
    }
  });

  it('returns focus to Add photo after removing a photo from the viewer', async () => {
    const objectUrls = installObjectUrlStub();
    const section = createCharacterJournalSection(
        createFakeService([createPhotoEntry()]),
    );

    try {
      await showSection(section);
      await flushPromises();

      const viewButton = document.querySelector<HTMLButtonElement>(
          '[aria-label="View photo camp.png"]',
      );
      if (viewButton === null) {
        throw new Error('Missing photo view button');
      }
      viewButton.click();
      expect(document.querySelector('.bfa-journal-photo-viewer')?.hasAttribute('hidden'))
          .toBe(false);

      document.querySelector<HTMLButtonElement>(
          '.bfa-journal-photo-viewer__button--danger',
      )?.click();
      await flushPromises();

      expect(document.querySelector('.bfa-journal-photo-viewer')?.hasAttribute('hidden'))
          .toBe(true);
      expect(document.activeElement).toBe(getButton('Add photo'));
    } finally {
    section.destroy();
    objectUrls.restore();
    }
  });

  it('keeps an unsaved draft when the journal is opened again', async () => {
    const section = createCharacterJournalSection(createFakeService([]));

    await showSection(section);
    getTitleInput().value = 'Unsaved title';
    getBodyInput().value = 'Unsaved body';
    section.hide();
    await showSection(section);

    expect(getTitleInput().value).toBe('Unsaved title');
    expect(getBodyInput().value).toBe('Unsaved body');
    await showSection(section);
    expect(getTitleInput().value).toBe('Unsaved title');

    section.destroy();
  });

  it('asks before closing a dirty journal and keeps the saved note after discard', async () => {
    const entries = [
      createEntry({
        id: 'entry-1',
        text: 'Saved text.',
        title: 'Saved title',
      }),
    ];
    const section = createCharacterJournalSection(createFakeService(entries));

    await showSection(section);
    getTitleInput().value = 'Changed title';
    section.requestHide();

    expect(section.isShown()).toBe(true);
    expect(getConfirmText()).toContain('unsaved changes');

    getConfirmButton('Discard').click();

    expect(section.isShown()).toBe(false);
    await showSection(section);
    expect(getTitleInput().value).toBe('Saved title');

    section.destroy();
  });

  it('deletes a confirmed note after the in-flight save finishes', async () => {
    let releaseSave = () => {};
    const saveGate = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    const entries = [
      createEntry({
        id: 'entry-1',
        text: 'Saved text.',
        title: 'Saved title',
      }),
    ];
    const service = createFakeService(entries);
    const saveTextEntry = service.saveTextEntry.bind(service);
    service.saveTextEntry = async (draft) => {
      await saveGate;
      return saveTextEntry(draft);
    };
    const section = createCharacterJournalSection(service);

    await showSection(section);
    getDeleteButton().click();
    getTitleInput().value = 'Changed while deleting';
    getSaveButton().click();
    getConfirmButton('Delete note').click();
    expect(entries).toHaveLength(1);

    releaseSave();
    await flushPromises();
    await flushPromises();

    expect(entries).toHaveLength(0);
    expect(getEditorStatus().textContent).toBe('Deleted.');

    section.destroy();
  });

  it('says storage is full when a save hits quota', async () => {
    const section = createCharacterJournalSection(createFakeService([], {
      saveError: new Error('QUOTA_BYTES quota exceeded'),
    }));

    await showSection(section);
    getTitleInput().value = 'Kept';
    getSaveButton().click();
    await flushPromises();

    expect(getEditorStatus().textContent)
        .toBe('Storage is full. Your note is still in the editor.');
    expect(getTitleInput().value).toBe('Kept');

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
    async attachImage(draft, file) {
      const entry = createEntry({
        id: draft.entryId ?? 'entry-photo',
        text: draft.text,
        title: draft.title.trim() === '' ? 'Untitled entry' : draft.title.trim(),
      });
      entry.blocks.push({
        blobKey: 'bfa.journal.image.photo-1',
        byteSize: file.size,
        fileName: file.name,
        height: null,
        id: 'photo-1',
        mimeType: 'image/png',
        type: 'image',
        width: null,
      });
      const existingIndex = entries.findIndex((candidate) => candidate.id === entry.id);
      if (existingIndex >= 0) {
        entries[existingIndex] = entry;
      } else {
        entries.unshift(entry);
      }
      return entry;
    },
    async deleteEntry(_characterId, entryId) {
      const entryIndex = entries.findIndex((entry) => entry.id === entryId);
      if (entryIndex >= 0) {
        entries.splice(entryIndex, 1);
      }
    },
    async getImage() {
      return {
        byteBuffer: new Uint8Array([1, 2, 3]).buffer,
        mimeType: 'image/png' as const,
      };
    },
    async listEntries(characterId) {
      return entries.filter((entry) => entry.characterId === characterId);
    },
    async countUnreadableEntries() {
      return 0;
    },
    async removeImage(draft, imageId) {
      const entry = createEntry({
        id: draft.entryId ?? 'entry-photo',
        text: draft.text,
        title: draft.title,
      });
      entry.blocks = entry.blocks.filter((block) => block.id !== imageId);
      const existingIndex = entries.findIndex((candidate) => candidate.id === entry.id);
      if (existingIndex >= 0) {
        entries[existingIndex] = entry;
      }
      return entry;
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
  updatedAt?: string;
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
    updatedAt: overrides.updatedAt ?? '2026-10-12T00:00:00.000Z',
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
  return getButton('Delete');
}

function getConfirmButton(label: string): HTMLButtonElement {
  const button = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
          '.bfa-character-journal-confirm button',
      ),
  ).find((candidate) => candidate.textContent === label);
  if (button === undefined) {
    throw new Error(`Missing ${label} confirmation button`);
  }

  return button;
}

function getConfirmText(): string {
  return document.querySelector('.bfa-character-journal-confirm-text')
      ?.textContent ?? '';
}

function getEntryButton(title: string): HTMLButtonElement {
  const button = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
          '.bfa-character-journal-entry-button',
      ),
  ).find((candidate) => {
    return candidate.querySelector('.bfa-character-journal-entry-title')
        ?.textContent === title;
  });
  if (button === undefined) {
    throw new Error(`Missing ${title} note button`);
  }

  return button;
}

function createPhotoEntry(): CharacterJournalEntry {
  const entry = createEntry({
    id: 'entry-camp',
    text: 'Rain on the tent.',
    title: 'Camp',
  });
  entry.blocks.push({
    blobKey: 'bfa.journal.image.photo-1',
    byteSize: 5,
    fileName: 'camp.png',
    height: null,
    id: 'photo-1',
    mimeType: 'image/png',
    type: 'image',
    width: null,
  });
  return entry;
}

function installObjectUrlStub(): {restore: () => void; revoked: string[]} {
  const revoked: string[] = [];
  const urlApi = URL as unknown as {
    createObjectURL?: (object: Blob) => string;
    revokeObjectURL?: (url: string) => void;
  };
  const previousCreate = urlApi.createObjectURL;
  const previousRevoke = urlApi.revokeObjectURL;
  let nextId = 0;

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: () => {
      nextId += 1;
      return `blob:journal-photo-${nextId}`;
    },
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: (url: string) => {
      revoked.push(url);
    },
  });

  return {
    restore() {
      defineUrlMethod('createObjectURL', previousCreate);
      defineUrlMethod('revokeObjectURL', previousRevoke);
    },
    revoked,
  };
}

function defineUrlMethod(
    name: 'createObjectURL' | 'revokeObjectURL',
    value: ((...args: never[]) => unknown) | undefined,
): void {
  if (value === undefined) {
    delete (URL as unknown as Record<string, unknown>)[name];
    return;
  }

  Object.defineProperty(URL, name, {
    configurable: true,
    value,
  });
}

function getButton(label: string): HTMLButtonElement {
  const button = Array.from(
      document.querySelectorAll<HTMLButtonElement>('button'),
  ).find((candidate) => candidate.textContent === label);
  if (button === undefined) {
    throw new Error(`Missing ${label} button`);
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
