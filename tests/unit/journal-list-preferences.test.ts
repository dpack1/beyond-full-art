import {describe, expect, it} from 'vitest';

import {
  DEFAULT_JOURNAL_LIST_PREFERENCES,
  getJournalListPreferences,
  setJournalListPreferences,
} from '../../src/platform/chrome/journal-list-preferences';

describe('journal list preferences', () => {
  it('defaults every optional list detail to hidden', async () => {
    const storage = createStorage();

    await expect(getJournalListPreferences(storage as never))
        .resolves.toEqual(DEFAULT_JOURNAL_LIST_PREFERENCES);
  });

  it('round-trips the optional list details', async () => {
    const storage = createStorage();
    const preferences = {
      showPreview: true,
      showThumbnail: true,
      showUpdatedDate: true,
    };

    await setJournalListPreferences(preferences, storage as never);

    await expect(getJournalListPreferences(storage as never)).resolves.toEqual(preferences);
  });

  it('falls back safely when a stored preference field is malformed', async () => {
    const storage = createStorage({
      'bfa.preferences.characterJournalListDetails': {
        showPreview: true,
        showThumbnail: 'yes',
      },
    });

    await expect(getJournalListPreferences(storage as never)).resolves.toEqual({
      showPreview: true,
      showThumbnail: false,
      showUpdatedDate: false,
    });
  });
});

function createStorage(initial: Record<string, unknown> = {}) {
  const values = {...initial};
  return {
    get(key: string, callback: (result: Record<string, unknown>) => void) {
      callback({[key]: values[key]});
    },
    set(next: Record<string, unknown>, callback: () => void) {
      Object.assign(values, next);
      callback();
    },
  };
}
