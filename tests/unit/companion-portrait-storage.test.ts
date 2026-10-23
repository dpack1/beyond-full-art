import {beforeEach, describe, expect, it} from 'vitest';

import {
  deleteCompanionPortraitSelection,
  getCompanionPortraitEnabled,
  getCompanionPortraitSelection,
  setCompanionPortraitEnabled,
  setCompanionPortraitSelection,
} from '../../src/platform/chrome/companion-portrait-storage';

describe('companion portrait storage', () => {
  beforeEach(() => {
    (globalThis as {chrome?: unknown}).chrome = {
      runtime: {lastError: undefined},
    };
  });

  it('defaults the feature to enabled and persists an override', async () => {
    const storage = createStorageArea();

    expect(await getCompanionPortraitEnabled(storage as never)).toBe(true);
    await setCompanionPortraitEnabled(false, storage as never);
    expect(await getCompanionPortraitEnabled(storage as never)).toBe(false);
  });

  it('round-trips and removes one validated selection', async () => {
    const storage = createStorageArea();
    const selection = {
      characterId: '169418374',
      companionId: 'familiar\u001fpetali\u001ftiny fey',
      group: 'Familiar',
      imageUrl: 'https://www.dndbeyond.com/avatars/petali.png',
      name: 'Petali',
      schemaVersion: 1 as const,
      type: 'Tiny Fey',
      updatedAt: '2026-10-22T00:00:00.000Z',
    };

    await setCompanionPortraitSelection(selection, storage as never);
    expect(await getCompanionPortraitSelection('169418374', storage as never))
        .toEqual(selection);

    await deleteCompanionPortraitSelection('169418374', storage as never);
    expect(await getCompanionPortraitSelection('169418374', storage as never))
        .toBeNull();
  });

  it('ignores malformed or cross-character selection records', async () => {
    const storage = createStorageArea({
      'bfa.companionPortrait.selection.169418374': {
        characterId: 'other',
        imageUrl: 'javascript:alert(1)',
      },
    });

    expect(await getCompanionPortraitSelection('169418374', storage as never))
        .toBeNull();
  });
});

function createStorageArea(initial: Record<string, unknown> = {}) {
  const values = {...initial};
  return {
    get(key: string, callback: (result: Record<string, unknown>) => void) {
      callback({[key]: values[key]});
    },
    remove(key: string, callback: () => void) {
      delete values[key];
      callback();
    },
    set(next: Record<string, unknown>, callback: () => void) {
      Object.assign(values, next);
      callback();
    },
  };
}
